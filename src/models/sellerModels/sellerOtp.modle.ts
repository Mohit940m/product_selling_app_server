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
      // Same non-unique-index-plus-upsert race as userModels/otp.model.ts
      // — see the comment there for the full explanation and why a
      // unique index isn't applied here without visibility into whether
      // this live collection already has duplicate identifiers.
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