import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../models/userModels/user.model.js";
import Seller from "../models/sellerModels/seller.model.js";
import dotenv from 'dotenv';
dotenv.config();

// Use JWT_SECRET directly, assuming dotenv is configured globally
const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: any;
  seller?: any;
}

const authenticateUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid token payload" });
    }

    // `email` is included alongside the authorization fields because
    // order.controller.ts's createOrder reads req.user.email to prefill
    // the Razorpay checkout modal — without it here, that field was
    // always undefined (silently blank prefill on every checkout), since
    // a .select() with only inclusions returns nothing else beyond _id.
    const user = await User.findById(userId)
    .select(" isActive isDeleted email ")
    .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid user",
      });
    } else if (!user.isActive || user.isDeleted) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive or deleted",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const authenticateSeller = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const sellerId = decoded.userId || decoded.id || decoded._id;

    if (!sellerId) {
      return res.status(401).json({ success: false, message: "Invalid token payload" });
    }

    const seller = await Seller.findById(sellerId)
    .select(" isActive isDeleted ")
    .lean();

    if (!seller) {
      return res.status(401).json({
        success: false,
        message: "Invalid seller",
      });
    } else if (!seller.isActive || seller.isDeleted) {
      return res.status(403).json({
        success: false,
        message: "Seller account is inactive or deleted",
      });
    }

    req.seller = seller;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const optionalAuthUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
    } catch {
      return next();
    }

    const userId = decoded.userId || decoded.id || decoded._id;
    if (!userId) return next();

    const user = await User.findById(userId).select("isActive isDeleted").lean();
    if (user && user.isActive && !user.isDeleted) {
      req.user = user;
    }

    next();
  } catch (error) {
    console.error("Optional Auth Middleware Error:", error);
    next();
  }
};

export { authenticateUser, authenticateSeller, optionalAuthUser };