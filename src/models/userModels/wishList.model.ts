import mongoose, { Schema, Document } from "mongoose";

export interface IWishList extends Document {
    userId: mongoose.Types.ObjectId;
    productId: mongoose.Types.ObjectId;
    addedAt: Date;
}

const wishListSchema = new Schema<IWishList>(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
            index: true
        },

        addedAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

wishListSchema.index({ userId: 1, productId: 1 }, { unique: true });

const WishList = mongoose.model<IWishList>("WishList", wishListSchema);

export default WishList;
export {};
