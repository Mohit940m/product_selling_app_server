import mongoose, { Schema, Document } from "mongoose";

export interface IOtp extends Document {
  identifier: string;
  otpHash: string;
  expiresAt: Date;
}

const otpSchema = new Schema<IOtp>(
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

const Otp = mongoose.model<IOtp>("Otp", otpSchema);

export default Otp;