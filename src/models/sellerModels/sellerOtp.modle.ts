import mongoose, { Schema, Document } from "mongoose";

export interface ISellerOtp extends Document {
  identifier: string;
  otpHash: string;
  expiresAt: Date;
}

const sellerOtpSchema = new Schema<ISellerOtp>(
  {
    identifier: {
      type: String, // phone or email
      required: true,
      index: true,
    },

    otpHash: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index
    },
  },
  { timestamps: true }
);

const SellerOtp = mongoose.model<ISellerOtp>("SellerOtp", sellerOtpSchema);

export default SellerOtp;