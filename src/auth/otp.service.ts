import crypto from "crypto";
import Otp from "../models/userModels/otp.model.js";
import SellerOtp from "../models/sellerModels/sellerOtp.modle.js";

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

const generateSellerOtp = async (identifier: string): Promise<string> => {
  const otp = generateNumericOtp();
  const otpHash = hashOtp(otp);

  const expiresAt = new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );

  const otpSave = await SellerOtp.findOneAndUpdate(
    { identifier },
    { otpHash, expiresAt },
    { upsert: true, new: true }
  );

  if (!otpSave) {
    throw new Error("Failed to generate OTP for seller.");
  };
  // console.log(otpSave);

  // console.log("Generated Seller OTP:", otp); // For testing/demo purposes

  return otp;
};

const verifySellerOtp = async (identifier: string, otp: string): Promise<boolean> => {
  const otpDoc = await SellerOtp.findOne({ identifier });

  if (!otpDoc) {
    return false;
  }

  if (otpDoc.expiresAt < new Date()) {
    await SellerOtp.deleteOne({ _id: otpDoc._id });
    return false;
  }

  const hashedInputOtp = hashOtp(otp);

  if (hashedInputOtp === otpDoc.otpHash) {
    await SellerOtp.deleteOne({ _id: otpDoc._id });
    return true;
  }

  return false;
};

const OtpService = { generateOtp, verifyOtp, generateSellerOtp, verifySellerOtp };

export { OtpService };
