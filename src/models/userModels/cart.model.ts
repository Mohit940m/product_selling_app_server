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
        // Not unique — a narrow, real race exists because of it.
        // addToCart's "find the user's cart, create one if it doesn't
        // exist" pattern (Cart.findOne({userId}) then `new Cart({...})`)
        // isn't atomic: two concurrent first-add-to-cart requests for the
        // same user can both see no existing cart and both create one,
        // leaving two Cart documents for one user. getCart/removeFromCart
        // only ever look at the first match, so the second becomes
        // invisible, silently-abandoned inventory of "lost" cart items
        // rather than a crash or visible error. Same class of gap as the
        // documented OTP race (otp.model.ts/sellerOtp.modle.ts) and left
        // for the same reason: adding `unique: true` here isn't safe to do
        // blind without live-DB visibility into whether duplicate Cart
        // documents already exist for some users — a unique index
        // creation fails outright if they do, and merging them
        // retroactively is a data decision, not a pure code fix. The real
        // fix is switching addToCart to an atomic
        // Cart.findOneAndUpdate({userId}, ..., {upsert: true}) plus adding
        // the unique index, but that's a deliberate change to make with
        // production data visibility, not something to guess at here.
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