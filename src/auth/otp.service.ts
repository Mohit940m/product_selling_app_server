import crypto from "crypto";
import Otp from "../models/userModels/otp.model.js";

const OTP_EXPIRY_MINUTES = 5;

const generateNumericOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const hashOtp = (otp: string): string => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

const generateOtp = async (identifier: string): Promise<string> => {
  const otp = generateNumericOtp();
  const otpHash = hashOtp(otp);

  const expiresAt = new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );

  await Otp.findOneAndUpdate(
    { identifier },
    { otpHash, expiresAt },
    { upsert: true, new: true }
  );

  return otp;
};

const verifyOtp = async (identifier: string, otp: string): Promise<boolean> => {
  const otpDoc = await Otp.findOne({ identifier });

  if (!otpDoc) {
    return false;
  }

  if (otpDoc.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: otpDoc._id });
    return false;
  }

  const hashedInputOtp = hashOtp(otp);

  if (hashedInputOtp === otpDoc.otpHash) {
    await Otp.deleteOne({ _id: otpDoc._id });
    return true;
  }

  return false;
};

const OtpService = { generateOtp, verifyOtp };

export { OtpService };
