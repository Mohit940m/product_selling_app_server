import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../../auth/auth.middleware.js";
import Order, { IOrderDocument, IOrderProduct, ORDER_STATUS, OrderStatus } from "../../models/orderModels/order.model.js";
import Product from "../../models/productModels/product.model.js";

const MAX_PAGE_SIZE = 50;
const VISIBLE_PAYMENT_STATUSES: IOrderDocument["paymentStatus"][] = ["PAID", "REFUNDED"];

// Includes soft-deleted products so past orders for them stay visible;
// permanently deleted products can't be matched and their orders drop out.
const getSellerProductIds = async (sellerId: mongoose.Types.ObjectId) =>
    Product.find({ sellerId }).distinct("_id");

// An order can mix several sellers' items, so a seller only ever sees their
// own lines and their own subtotal — never other sellers' items or the
// order's grand total/discount/shipping, which cover everyone's items.
const toSellerView = (order: IOrderDocument, productIds: Set<string>) => {
    const items = order.items.filter((item: IOrderProduct) => productIds.has(item.productId.toString()));
    return {
        _id: order._id,
        orderId: order.orderId,
        createdAt: order.createdAt,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        shippingAddress: order.shippingAddress,
        tracking: order.tracking,
        items,
        canUpdateStatus: items.length === order.items.length && order.paymentStatus === "PAID",
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

// Accepts either the Mongo _id or the ORD-... orderId.
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
        const idFilter = mongoose.isValidObjectId(orderId) ? { _id: orderId } : { orderId };
        const order = productIds.length === 0
            ? null
            : await Order.findOne({
                ...idFilter,
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

// Forward-only fulfilment path. CANCELLED is deliberately not settable here:
// these orders are already paid and there is no refund flow yet.
const FULFILMENT_FLOW: OrderStatus[] = [
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
];

const cleanString = (value: unknown, max = 200) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

const updateSellerOrderStatus = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({ success: false, message: "Unauthorized. Seller not found." });
        }

        const { orderId } = req.params;
        const { status, tracking } = req.body ?? {};

        const targetIndex = FULFILMENT_FLOW.indexOf(status);
        if (targetIndex <= 0) {
            return res.status(400).json({
                success: false,
                message: `status must be one of: ${FULFILMENT_FLOW.slice(1).join(", ")}.`,
            });
        }

        let trackingUpdate: { courier: string; trackingId: string; trackingUrl: string } | undefined;
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
        const idFilter = mongoose.isValidObjectId(orderId) ? { _id: orderId } : { orderId };
        const order = productIds.length === 0
            ? null
            : await Order.findOne({
                ...idFilter,
                paymentStatus: "PAID",
                "items.productId": { $in: productIds },
            });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        // One order carries one status for all of its items, so a seller may
        // only drive fulfilment for orders that contain nothing but their own products.
        const idSet = new Set(productIds.map((id) => id.toString()));
        if (order.items.some((item) => !idSet.has(item.productId.toString()))) {
            return res.status(409).json({
                success: false,
                message: "This order includes items from other sellers, so its status can't be changed from one seller's account.",
            });
        }

        const currentIndex = FULFILMENT_FLOW.indexOf(order.orderStatus);
        if (currentIndex === -1 || targetIndex <= currentIndex) {
            return res.status(409).json({
                success: false,
                message: `Order is ${order.orderStatus}; it can only move forward to a later stage.`,
            });
        }

        // Conditional on the status we read, so two concurrent updates can't both apply.
        const updated = await Order.findOneAndUpdate(
            { _id: order._id, orderStatus: order.orderStatus },
            { $set: { orderStatus: status, ...(trackingUpdate ? { tracking: trackingUpdate } : {}) } },
            { new: true }
        );

        if (!updated) {
            return res.status(409).json({ success: false, message: "Order was updated by someone else. Reload and try again." });
        }

        return res.status(200).json({
            success: true,
            message: `Order marked ${status}.`,
            data: toSellerView(updated, idSet),
        });
    } catch (error: any) {
        console.error("Update Seller Order Status Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

export { getSellerOrders, getSellerOrderById, updateSellerOrderStatus };
