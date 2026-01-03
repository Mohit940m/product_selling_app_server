import { Request, Response } from 'express';
import User from '../../models/userModels/user.model.js';
import { AuthRequest } from '../../auth/auth.middleware.js';

const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required.'
      });
    }

    const userId = req.user._id;

    // Assuming req.user is populated by the authentication middleware
    const user = await User.findById(userId)
    .select(" name email phone profileImage dob gender  isActive isDeleted  isPhoneVerified isEmailVerified ");

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found.' 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        success: false,
        message: 'Your account is inactive. Please contact support.' 
      });
    }

    if (user.isDeleted) {
      return res.status(403).json({ 
        success: false,
        message: 'Your account has been deleted.' 
      });
    }

    return res.status(200).json({ 
      success: true,
      data: user
    });
  } catch (error: any) {
    return res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

export { getUserProfile };
export {};
