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

const Order = mongoose.model<IOrderDocument>("Order", orderSchema);
export default Order;