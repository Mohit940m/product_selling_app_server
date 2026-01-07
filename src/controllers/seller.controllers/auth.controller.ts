import { Request, Response } from 'express';
import Seller from '../../models/sellerModels/seller.model.js';
import { OtpService } from '../../auth/otp.service.js';
import {
    generateAuthToken,
} from '../../utils/jwt.js';

export class AuthController {

  /**
   * Step 1: Register Seller
   * - Validates email or phone exists.
   * - Checks for uniqueness in DB.
   * - Saves Seller to DB (Unverified).
   * - Generates and sends OTP.
   */
  static async registerSeller(req: Request, res: Response) {
    try {
      const { name, email, phone, password, ...otherFields } = req.body;
        // 1. Validate name, email and password exist
        if (!name) {
            return res.status(400).json({ 
                success: false,
                message: 'Name is required.' 
            });
        }
        if (!email) {
            return res.status(400).json({ 
                success: false,
                message: 'Email is required.' 
            });
        }
        if (!password) {
            return res.status(400).json({ 
                success: false,
                message: 'Password is required.' 
            });
        }

        // 2. Check Uniqueness of Email
        const existingSeller = await Seller.findOne({ email });
        if (existingSeller) {
            return res.status(409).json({ 
                success: false,
                message: 'Email already in use.' 
            });
        }

        // if phone is provided, check its uniqueness as well
        if (phone) {
            const existingPhoneSeller = await Seller.findOne({ phone });
            if (existingPhoneSeller) {
                return res.status(409).json({ 
                    success: false,
                    message: 'Phone number already in use.' 
                });
            }
        }

        // 3. Create Seller in Database
        const newSeller = await Seller.create({
            name,
            email,
            phone,
            password,
            ...otherFields,
            isEmailVerified: false
        });

        // 4. Generate OTP via Service
        const otp = await OtpService.generateSellerOtp(email);

        return res.status(201).json({
            success: true,
            message: 'Seller registered successfully. Please verify OTP.',
            otp, // Send the generated OTP to the client
            email
        });
    } catch (error) {
      console.error('Error in registerSeller:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error during seller registration.',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Step 2: Verify OTP for Registration
   * - Accepts Email and OTP.
   * - Verifies OTP.
   * - Updates Seller verification status.
   * - Logs seller in (returns Auth Token).
   */
  static async verifyOtpForRegistration(req: Request, res: Response) {
    try {
      const { otp, email } = req.body;

      if (!otp || !email) {
        return res.status(400).json({
          success: false,
          message: 'OTP and Email are required.',
        });
      }

      // 1. Verify OTP
      const isOtpValid = await OtpService.verifySellerOtp(email, otp);
      if (!isOtpValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP.',
        });
      }

      // 2. Find Seller
      const seller = await Seller.findOne({ email });
      if (!seller) {
          return res.status(404).json({
              success: false,
              message: 'Seller not found.'
          });
      }

      // 3. Update Verification Status
      seller.isEmailVerified = true;
      await seller.save();

      // 4. Generate Login Token
      const authToken = generateAuthToken(seller._id.toString());

      return res.status(200).json({
        success: true,
        message: 'Seller verified and logged in successfully.',
        token: authToken,
        seller: seller
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Server error during seller verification.',
      });
    }
  }

  /**
   * Step 1: Login Seller
   * - Checks if user exists.
   * - Sends OTP.
   */
    static async loginSeller(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is required for login.'
                });
            }

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required for login.'
                });
            }

            // 1. Find Seller


            const seller = await Seller.findOne({ email }).select('+password');
            if (!seller) {
                return res.status(404).json({
                    success: false,
                    message: 'Seller not found.'
                });
            }
            // 2. Verify Password
            const isPasswordValid = await seller.comparePassword(password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password.'
                });
            }

            // 3. Generate OTP via Service

            const otp = await OtpService.generateSellerOtp(email);

            return res.status(200).json({
                success: true,
                message: 'OTP sent for login.',
                otp // Send the generated OTP to the client
            });
        } catch (error) {
            console.error('Error in loginSeller:', error);
            return res.status(500).json({
                success: false,
                message: 'Server error during seller login.',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
   * Step 2: Verify OTP for Login
   */
    static async verifyOtpForLogin(req: Request, res: Response) {
        try {
            const { otp, email } = req.body;

            if (!otp || !email) {
                return res.status(400).json({
                    success: false,
                    message: 'OTP and Email are required.'
                });
            }

            const isOtpValid = await OtpService.verifySellerOtp(email, otp);
            if (!isOtpValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid OTP.'
                });
            }

            // 3. Find Seller to get ID
            const seller = await Seller.findOne({ email });
            if (!seller) {
                return res.status(404).json({
                    success: false,
                    message: 'Seller not found.'
                });
            }

            // 4. Generate Login Token
            const authToken = generateAuthToken(seller._id.toString());

            return res.status(200).json({
                success: true,
                message: 'Seller logged in successfully.',
                token: authToken
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Server error during seller login verification.'
            });
        }
    }
};

export {};