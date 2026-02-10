import mongoose, { Schema, Document } from "mongoose";

export interface IAddress extends Document {
    user: mongoose.Types.ObjectId;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    isDefault: boolean;
}

const addressSchema = new Schema<IAddress>(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        addressLine1: { type: String, required: true },
        addressLine2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        country: { type: String, default: "India" },
        isDefault: { type: Boolean, default: false }
    },
    { timestamps: true }
);

// Ensure only one default address per user
addressSchema.index({ user: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

const Address = mongoose.model<IAddress>("Address", addressSchema);

export default Address;