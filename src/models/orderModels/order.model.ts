import mongoose, { Schema, Document } from "mongoose";

export const ORDER_STATUS = {
  CREATED: "CREATED",
  CONFIRMED: "CONFIRMED",
  SHIPPED: "SHIPPED",
  OUT_FOR_DELIVERY: "OUT FOR DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export interface IOrderProduct {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  name: string;
  image: string;
  priceAtPurchase: number;
  quantity: number;
  attributes: Record<string, any>;
}

export interface IOrderAddress {
  addressId?: mongoose.Types.ObjectId;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IOrderDocument extends Document {
  orderId: string;
  user: mongoose.Types.ObjectId;
  items: IOrderProduct[];
  shippingAddress: IOrderAddress;
  
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  orderStatus: OrderStatus;
  
  subTotal: number;
  discount: number;
  shippingCost: number;
  tax: number;
  totalAmount: number;
  
  appliedOffer?: mongoose.Types.ObjectId;
  
  tracking?: {
    courier: string;
    trackingId: string;
    trackingUrl: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const orderProductSchema = new Schema<IOrderProduct>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
    },
    name: { type: String, required: true },
    image: { type: String, required: true },
    priceAtPurchase: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    attributes: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const orderAddressSchema = new Schema<IOrderAddress>(
  {
    addressId: { type: Schema.Types.ObjectId, ref: "Address" },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: "India" },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrderDocument>(
  {
    orderId: {
      type: String,
      required: true,
      // A real, higher-stakes cousin of the sku collision risk documented
      // on variant.model.ts: this is a SEPARATE unique constraint from
      // Mongo's own _id (which already has strong, purpose-built collision
      // resistance) — Date.now() (millisecond resolution) plus a 0-9999
      // random value gives only ~10,000 possibilities for any two orders
      // that happen to be created in the same millisecond, which genuinely
      // concurrent checkout traffic (a flash sale, say) could hit. Used as
      // the Razorpay `receipt` value in createOrder, so it's not purely
      // cosmetic. A collision throws a raw Mongo duplicate-key error out
      // of newOrder.save() in createOrder, surfaced as a generic 500 to a
      // paying customer mid-checkout, with no retry. Not changed here —
      // e.g. swapping to a crypto-random suffix, or retrying generation on
      // a duplicate-key error — since, like the sku case, picking the
      // actual strategy is a real decision, not a one-line fix.
      unique: true,
      default: () => `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: [orderProductSchema],
    shippingAddress: {
      type: orderAddressSchema,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },
    orderStatus: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.CREATED,
      index: true,
    },
    subTotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    
    appliedOffer: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
    },
    
    tracking: {
      courier: String,
      trackingId: String,
      trackingUrl: String,
    },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, paymentStatus: 1, createdAt: -1 });

const Order = mongoose.model<IOrderDocument>("Order", orderSchema);
export default Order;