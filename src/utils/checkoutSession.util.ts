import mongoose from "mongoose";
import { AuthRequest } from "../auth/auth.middleware.js";
import CheckoutSession, {
    CHECKOUT_SESSION_STATUS,
    type CheckoutSource,
} from "../models/orderModels/checkoutSession.model.js";

// The MCP API client (src/mcp/client/apiClient.ts) tags its requests with this
// header, so checkouts made through the AI assistant can be told apart.
export const CLIENT_SOURCE_HEADER = "x-client-source";

const sourceOf = (req: AuthRequest): CheckoutSource =>
    req.get(CLIENT_SOURCE_HEADER) === "assistant" ? "assistant" : "app";

/**
 * Cart lines as checkout/createOrder already hold them (productId and
 * variantId populated), paired with the per-unit price the buyer was shown.
 */
export const toSessionItems = (cartItems: any[], unitPrices: number[]) =>
    cartItems.map((item, i) => ({
        productId: item.productId._id,
        variantId: item.variantId._id,
        sellerId: item.productId.sellerId,
        name: item.productId.name,
        image: item.productId.images?.[0],
        attributes: item.attributes,
        quantity: item.quantity,
        price: unitPrices[i],
    }));

type SessionItem = ReturnType<typeof toSessionItems>[number];

/**
 * Upserts the buyer's open checkout session with what they're about to buy.
 * Tracking must never break checkout, so this is fire-and-forget and only logs.
 */
export const recordCheckoutSession = (
    req: AuthRequest,
    items: SessionItem[],
    address: { fullName?: string; phone?: string } | null,
    { reachedPayment = false } = {}
) => {
    if (!req.user || items.length === 0) return;

    const sellerIds = [...new Set(items.map((i) => i.sellerId.toString()))].map(
        (id) => new mongoose.Types.ObjectId(id)
    );

    CheckoutSession.findOneAndUpdate(
        { user: req.user._id, status: CHECKOUT_SESSION_STATUS.OPEN },
        {
            $set: {
                items,
                sellerIds,
                contact: { fullName: address?.fullName, phone: address?.phone },
                lastCheckoutAt: new Date(),
                ...(reachedPayment ? { reachedPayment: true } : {}),
            },
            $addToSet: { sources: sourceOf(req) },
            $inc: { checkoutCount: 1 },
        },
        { upsert: true }
    ).catch((error) => console.error("Record Checkout Session Error:", error));
};

/** Marks the buyer's open session as completed by this (now paid) order. */
export const completeCheckoutSession = (userId: mongoose.Types.ObjectId, orderId: mongoose.Types.ObjectId) => {
    CheckoutSession.findOneAndUpdate(
        { user: userId, status: CHECKOUT_SESSION_STATUS.OPEN },
        { $set: { status: CHECKOUT_SESSION_STATUS.COMPLETED, completedAt: new Date(), order: orderId } }
    ).catch((error) => console.error("Complete Checkout Session Error:", error));
};
