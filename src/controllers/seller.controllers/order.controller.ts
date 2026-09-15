import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../../auth/auth.middleware.js";
import Order, { IOrderDocument, IOrderTracking, OrderStatus } from "../../models/orderModels/order.model.js";
import Product from "../../models/productModels/product.model.js";
import { FULFILMENT_FLOW, deriveOrderStatus, resolveItems } from "../../utils/fulfilment.util.js";

const MAX_PAGE_SIZE = 50;
const VISIBLE_PAYMENT_STATUSES: IOrderDocument["paymentStatus"][] = ["PAID", "REFUNDED"];

// Includes soft-deleted products so past orders for them stay visible;
// permanently deleted products can't be matched and their orders drop out.
const getSellerProductIds = async (sellerId: mongoose.Types.ObjectId) =>
    Product.find({ sellerId }).distinct("_id");

const orderLookup = (orderId: string) =>
    mongoose.isValidObjectId(orderId)
        ? { _id: orderId }
        : { $or: [{ orderId }, { "items.subOrderId": orderId }] };

// An order can mix several sellers' items, so a seller only ever sees their
// own lines and their own subtotal — never other sellers' items or the
// order's grand total/discount/shipping, which cover everyone's items.
const toSellerView = (order: IOrderDocument, productIds: Set<string>) => {
    const plain = order.toObject() as IOrderDocument;
    const items = resolveItems(plain).filter((item) => productIds.has(item.productId.toString()));
    return {
        _id: plain._id,
        orderId: plain.orderId,
        createdAt: plain.createdAt,
        paymentStatus: plain.paymentStatus,
        orderStatus: deriveOrderStatus(items.map((i) => i.status), plain.orderStatus),
        shippingAddress: plain.shippingAddress,
        items,
        canUpdateStatus: plain.paymentStatus === "PAID",
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        sellerSubtotal: items.reduce((sum, item) => sum + item.priceAtPurchase * item.quantity, 0),
    };
};

const getSellerOrders = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({ success: false, message: "Unauthorized. Seller not found." });
        }

        const pageNum = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), MAX_PAGE_SIZE);

        const productIds = await getSellerProductIds(req.seller._id);
        if (productIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
            });
        }

        const filter = {
            paymentStatus: { $in: VISIBLE_PAYMENT_STATUSES },
            "items.productId": { $in: productIds },
        };

        const [orders, total] = await Promise.all([
            Order.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
            Order.countDocuments(filter),
        ]);

        const idSet = new Set(productIds.map((id) => id.toString()));
        return res.status(200).json({
            success: true,
            data: orders.map((order) => toSellerView(order, idSet)),
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (error: any) {
        console.error("Get Seller Orders Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

// Accepts the Mongo _id, the ORD-... orderId, or an item's ORD-...-N subOrderId.
const getSellerOrderById = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({ success: false, message: "Unauthorized. Seller not found." });
        }

        const { orderId } = req.params;
        if (!orderId) {
            return res.status(400).json({ success: false, message: "orderId is required." });
        }

        const productIds = await getSellerProductIds(req.seller._id);
        const order = productIds.length === 0
            ? null
            : await Order.findOne({
                ...orderLookup(orderId),
                paymentStatus: { $in: VISIBLE_PAYMENT_STATUSES },
                "items.productId": { $in: productIds },
            });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const idSet = new Set(productIds.map((id) => id.toString()));
        return res.status(200).json({ success: true, data: toSellerView(order, idSet) });
    } catch (error: any) {
        console.error("Get Seller Order Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

const cleanString = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

// Moves one item (sub-order) forward. CANCELLED isn't settable: items are
// paid for and there's no refund flow yet.
const updateSellerOrderItemStatus = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({ success: false, message: "Unauthorized. Seller not found." });
        }

        const { orderId, subOrderId } = req.params;
        const { status, tracking } = req.body ?? {};

        const targetIndex = FULFILMENT_FLOW.indexOf(status);
        if (targetIndex <= 0) {
            return res.status(400).json({
                success: false,
                message: `status must be one of: ${FULFILMENT_FLOW.slice(1).join(", ")}.`,
            });
        }

        let trackingUpdate: IOrderTracking | undefined;
        if (tracking !== undefined && tracking !== null) {
            const courier = cleanString(tracking.courier, 100);
            const trackingId = cleanString(tracking.trackingId, 100);
            const trackingUrl = cleanString(tracking.trackingUrl, 500);
            if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
                return res.status(400).json({ success: false, message: "trackingUrl must start with http:// or https://." });
            }
            if (courier || trackingId || trackingUrl) {
                trackingUpdate = { courier, trackingId, trackingUrl };
            }
        }

        const productIds = await getSellerProductIds(req.seller._id);
        const idSet = new Set(productIds.map((id) => id.toString()));
        const order = productIds.length === 0
            ? null
            : await Order.findOne({
                ...orderLookup(orderId),
                paymentStatus: "PAID",
                "items.productId": { $in: productIds },
            });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const plain = order.toObject() as IOrderDocument;
        const resolved = resolveItems(plain);
        const index = resolved.findIndex((item) => item.subOrderId === subOrderId);
        if (index === -1 || !idSet.has(resolved[index].productId.toString())) {
            return res.status(404).json({ success: false, message: "Item not found in this order." });
        }

        const current = resolved[index].status as OrderStatus;
        const currentIndex = FULFILMENT_FLOW.indexOf(current);
        if (currentIndex === -1 || targetIndex <= currentIndex) {
            return res.status(409).json({
                success: false,
                message: `Item is ${current}; it can only move forward to a later stage.`,
            });
        }

        // Conditional on the item's stored status (or, for items created before
        // per-item fulfilment, its absence plus the order status it inherited),
        // so two concurrent updates can't both apply.
        const rawStatus = plain.items[index].status;
        const itemPath = `items.${index}`;
        const guard = rawStatus
            ? { [`${itemPath}.status`]: rawStatus }
            : { [`${itemPath}.status`]: { $exists: false }, orderStatus: plain.orderStatus };

        const updated = await Order.findOneAndUpdate(
            { _id: plain._id, [`${itemPath}.productId`]: resolved[index].productId, ...guard },
            {
                $set: {
                    [`${itemPath}.status`]: status,
                    [`${itemPath}.subOrderId`]: resolved[index].subOrderId,
                    [`${itemPath}.statusUpdatedAt`]: new Date(),
                    ...(trackingUpdate ? { [`${itemPath}.tracking`]: trackingUpdate } : {}),
                },
            },
            { new: true }
        );

        if (!updated) {
            return res.status(409).json({ success: false, message: "This item was updated by someone else. Reload and try again." });
        }

        // Stored order-level status is a summary kept for queries; responses derive it from items.
        const summary = deriveOrderStatus(
            resolveItems(updated.toObject() as IOrderDocument).map((i) => i.status),
            updated.orderStatus
        );
        if (summary !== updated.orderStatus) {
            await Order.updateOne({ _id: updated._id }, { $set: { orderStatus: summary } });
        }

        return res.status(200).json({
            success: true,
            message: `${resolved[index].subOrderId} marked ${status}.`,
            data: toSellerView(updated, idSet),
        });
    } catch (error: any) {
        console.error("Update Seller Order Item Status Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

export { getSellerOrders, getSellerOrderById, updateSellerOrderItemStatus };
