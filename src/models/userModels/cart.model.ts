import mongoose, { Schema, Document } from "mongoose";

export interface ICart extends Document {
    userId: mongoose.Types.ObjectId;
    items: ICartItem[];
    subTotal: number;
    discount: number;
    total: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICartItem {
    productId: mongoose.Types.ObjectId;
    variantId: mongoose.Types.ObjectId;
    quantity: number;
    attributes: object;
    priceSnapshot: number;
    addedAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
            index: true
        },

        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Variant",
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            default: 1,
            min: 1
        },

        attributes: {
            type: Object,
            required: true
        },

        priceSnapshot: {
            type: Number,
            required: true,
            min: 0
        },

        addedAt: {
            type: Date,
            default: Date.now
        }
    },
    { _id: false }
);

const cartSchema = new Schema<ICart>(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        items: [cartItemSchema],
        subTotal: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },
        discount: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },
        total: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        }
    },
    { timestamps: true }
);

const Cart = mongoose.model<ICart>("Cart", cartSchema);

export default Cart;
export {};