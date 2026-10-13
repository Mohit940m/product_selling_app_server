import { Response } from "express";
import { AuthRequest } from "../../auth/auth.middleware.js";
import CheckoutSession, {
    CHECKOUT_SESSION_STATUS,
    type CheckoutSessionStatus,
    type ICheckoutSessionDocument,
} from "../../models/orderModels/checkoutSession.model.js";

const MAX_PAGE_SIZE = 50;

const STATUS_FILTERS: Record<string, CheckoutSessionStatus[]> = {
    not_placed: [CHECKOUT_SESSION_STATUS.OPEN],
    completed: [CHECKOUT_SESSION_STATUS.COMPLETED],
    all: [CHECKOUT_SESSION_STATUS.OPEN, CHECKOUT_SESSION_STATUS.COMPLETED],
};

// A session can hold several sellers' items; a seller only sees their own
// lines. Contact details come from the account first, then the checkout address.
const toSellerView = (session: ICheckoutSessionDocument, sellerId: string) => {
    const plain = session.toObject() as any;
    const user = plain.user && typeof plain.user === "object" ? plain.user : {};
    const items = (plain.items ?? []).filter((item: any) => item.sellerId.toString() === sellerId);
    return {
        _id: plain._id,
        status: plain.status === CHECKOUT_SESSION_STATUS.COMPLETED ? "COMPLETED" : "NOT_PLACED",
        customer: {
            name: user.name || plain.contact?.fullName || null,
            email: user.email || null,
            phone: user.phone || plain.contact?.phone || null,
        },
        items,
        itemCount: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        sellerSubtotal: items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0),
        sources: plain.sources ?? [],
        reachedPayment: !!plain.reachedPayment,
        checkoutCount: plain.checkoutCount ?? 1,
        lastCheckoutAt: plain.lastCheckoutAt,
        completedAt: plain.completedAt ?? null,
        orderId: plain.order?.orderId ?? null,
    };
};

/**
 * Logged-in buyers who reached checkout with this seller's products.
 * ?status=not_placed (default) | completed | all
 */
const getSellerCheckouts = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.seller) {
            return res.status(401).json({ success: false, message: "Unauthorized. Seller not found." });
        }

        const status = typeof req.query.status === "string" ? req.query.status : "not_placed";
        const statuses = Object.prototype.hasOwnProperty.call(STATUS_FILTERS, status) ? STATUS_FILTERS[status] : undefined;
        if (!statuses) {
            return res.status(400).json({
                success: false,
                message: `status must be one of: ${Object.keys(STATUS_FILTERS).join(", ")}.`,
            });
        }

        const pageNum = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), MAX_PAGE_SIZE);
        const sellerId = req.seller._id;
        const filter = { sellerIds: sellerId, status: { $in: statuses } };

        const [sessions, total, notPlaced, completed] = await Promise.all([
            CheckoutSession.find(filter)
                .sort({ lastCheckoutAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .populate("user", "name email phone")
                .populate("order", "orderId"),
            CheckoutSession.countDocuments(filter),
            CheckoutSession.countDocuments({ sellerIds: sellerId, status: CHECKOUT_SESSION_STATUS.OPEN }),
            CheckoutSession.countDocuments({ sellerIds: sellerId, status: CHECKOUT_SESSION_STATUS.COMPLETED }),
        ]);

        return res.status(200).json({
            success: true,
            data: sessions.map((session) => toSellerView(session, sellerId.toString())),
            summary: { notPlaced, completed },
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (error: any) {
        console.error("Get Seller Checkouts Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

export { getSellerCheckouts };
