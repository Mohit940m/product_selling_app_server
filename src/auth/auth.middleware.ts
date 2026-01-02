import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload }from "jsonwebtoken";
import User from "../models/userModels/user.model.js";

export interface AuthRequest extends Request {
  user?: JwtPayload | string;
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

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: string };

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid user",
      });
    }else if (!user.isActive || user.isDeleted) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive or deleted",
      });
    }


    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export default authenticateUser;
