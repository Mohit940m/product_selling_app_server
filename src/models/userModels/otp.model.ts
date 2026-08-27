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
      // Not `unique: true`: otp.service.ts upserts on this field
      // (findOneAndUpdate with upsert: true), and a non-unique index
      // leaves a narrow race — two truly concurrent OTP requests for the
      // same identifier (e.g. a fast double-click on "Resend") could both
      // see "no existing doc" and both insert, leaving two docs for one
      // identifier; a later findOne({identifier}) would then pick
      // whichever one Mongo returns first, which might not be the newest
      // OTP the user actually has. A unique index is the correct fix
      // (MongoDB's upsert-under-unique-index path retries as an update
      // instead of a second insert when it hits the race) but adding one
      // isn't safe to do blindly here: if this collection already has
      // duplicate identifiers from a past instance of this exact race,
      // index creation would fail on next connect. Left as a documented
      // gap rather than guessed at without visibility into live data.
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