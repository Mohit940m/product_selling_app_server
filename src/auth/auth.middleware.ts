import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../models/userModels/user.model.js";
import dotenv from 'dotenv';
dotenv.config();

// Use JWT_SECRET directly, assuming dotenv is configured globally
const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: any;
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

    const user = await User.findById(userId)
    .select(" isActive isDeleted ")
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

export default authenticateUser;
