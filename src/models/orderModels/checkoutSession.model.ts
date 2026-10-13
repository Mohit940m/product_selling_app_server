import mongoose, { Schema, Document } from "mongoose";

// A logged-in buyer reaching checkout (storefront page or the AI assistant's
// checkout_summary tool, which share POST /orders/checkout). Sellers see the
// ones still OPEN as "not placed" leads; verifyPayment flips the buyer's open
// session to COMPLETED. Guests can't reach checkout, so every row has a user.
export const CHECKOUT_SESSION_STATUS = {
  OPEN: "OPEN",
  COMPLETED: "COMPLETED",
} as const;

export type CheckoutSessionStatus = typeof CHECKOUT_SESSION_STATUS[keyof typeof CHECKOUT_SESSION_STATUS];

export const CHECKOUT_SOURCES = ["app", "assistant"] as const;
export type CheckoutSource = typeof CHECKOUT_SOURCES[number];

export interface ICheckoutSessionItem {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  name: string;
  image?: string;
  attributes?: Record<string, any>;
  quantity: number;
  price: number;
}

export interface ICheckoutSessionDocument extends Document {
  user: mongoose.Types.ObjectId;
  status: CheckoutSessionStatus;
  items: ICheckoutSessionItem[];
  sellerIds: mongoose.Types.ObjectId[];
  sources: CheckoutSource[];
  // Name/phone from the checkout address, used when the account itself has none.
  contact: { fullName?: string; phone?: string };
  // True once the buyer pressed pay (create-order), not just viewed the summary.
  reachedPayment: boolean;
  checkoutCount: number;
  lastCheckoutAt: Date;
  completedAt?: Date;
  order?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const checkoutSessionItemSchema = new Schema<ICheckoutSessionItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "Seller", required: true },
    name: { type: String, required: true },
    image: { type: String },
    attributes: { type: Schema.Types.Mixed },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const checkoutSessionSchema = new Schema<ICheckoutSessionDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: Object.values(CHECKOUT_SESSION_STATUS),
      default: CHECKOUT_SESSION_STATUS.OPEN,
    },
    items: [checkoutSessionItemSchema],
    sellerIds: [{ type: Schema.Types.ObjectId, ref: "Seller" }],
    sources: [{ type: String, enum: CHECKOUT_SOURCES }],
    contact: {
      fullName: { type: String },
      phone: { type: String },
    },
    reachedPayment: { type: Boolean, default: false },
    checkoutCount: { type: Number, default: 0 },
    lastCheckoutAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true }
);

// At most one open session per buyer; repeat checkouts update it in place.
checkoutSessionSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { status: CHECKOUT_SESSION_STATUS.OPEN } }
);
checkoutSessionSchema.index({ sellerIds: 1, status: 1, lastCheckoutAt: -1 });

const CheckoutSession = mongoose.model<ICheckoutSessionDocument>("CheckoutSession", checkoutSessionSchema);
export default CheckoutSession;
