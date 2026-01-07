import { Request, Response } from 'express';
import User  from  '../../models/userModels/user.model.js';
import { OtpService } from '../../auth/otp.service.js';
import { 
  generateRegistrationToken, 
  verifyRegistrationToken, 
  generateAuthToken
} from '../../utils/jwt.js';

export class AuthController {

  /**
   * Step 1: Register User
   * - Validates email or phone exists.
   * - Checks for uniqueness in DB.
   * - Generates OTP.
   * - Returns a Registration JWT containing user data (stateless registration).
   */
  static async registerUser(req: Request, res: Response) {
    try {
      const { email, phone, ...otherFields } = req.body;

      // 1. Validate at least one identifier is present
      if (!email && !phone) {
        return res.status(400).json({ 
            success: false,
            message: 'Email or Phone number is required.' 
        });
      }

      // 2. Check Uniqueness (Email and Phone must be unique)
      const query: any[] = [];
      if (email) query.push({ email });
      if (phone) query.push({ phone });

      const existingUser = await User.findOne({ $or: query });
      if (existingUser) {
        return res.status(409).json({ 
            success: false,
            message: 'Email or Phone already in use.' 
        });
      }

      // 3. Generate OTP via Service
      const identifier = email || phone;
      const otp = await OtpService.generateOtp(identifier);

      // 4. Create Registration Token
      // We exclude profileImage here as requested, to be added later in edit profile
      const registrationPayload = {
        email,
        phone,
        ...otherFields
      };

      const registrationToken = generateRegistrationToken(registrationPayload);

      return res.status(200).json({
        success: true,
        message: 'OTP sent successfully. Please verify to complete registration.',
        otp, // Send the generated OTP to the client
        registrationToken, // Client must send this back with the OTP
      });

    } catch (error: any) {
      return res.status(500).json({ 
        success: false,
        message: error.message 
    });
    }
  }

  /**
   * Step 2: Verify OTP for Registration
   * - Decodes the Registration Token.
   * - Verifies OTP.
   * - Creates the User in DB.
   * - Logs user in (returns Auth Token).
   */
  static async verifyOtpForRegistration(req: Request, res: Response) {
    try {
      const { otp, registrationToken } = req.body;

      if (!otp || !registrationToken) {
        return res.status(400).json({ 
            success: false,
            message: 'OTP and Registration Token are required.' 
        });
      }

      // 1. Decode and Verify Token
      const userData = verifyRegistrationToken(registrationToken);
      const identifier = userData.email || userData.phone;

      if (!identifier) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid registration data.' 
        });
      }

      // 2. Verify OTP
      const isOtpValid = await OtpService.verifyOtp(identifier, otp);
      if (!isOtpValid) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid OTP.' 
        });
      }

      // 3. Create User in Database
      const newUser = await User.create(userData);

      // 4. Generate Login Token
      const authToken = generateAuthToken(newUser._id.toString());

      return res.status(201).json({
        success: true,
        message: 'User registered and logged in successfully.',
        token: authToken,
        user: newUser
      });

    } catch (error: any) {
      return res.status(400).json({ 
        success: false,
        message: error.message 
    });
    }
  }

  /**
   * Step 1: Login User
   * - Checks if user exists.
   * - Sends OTP.
   */
  static async loginUser(req: Request, res: Response) {
    try {
      const { email, phone } = req.body;
      
      if (!email && !phone) {
        return res.status(400).json({ 
            success: false,
            message: 'Email or Phone is required.' 
        });
      }

      const user = await User.findOne({ $or: [{ email }, { phone }] });
      if (!user) {
        return res.status(404).json({ 
            success: false,
            message: 'User not found.' 
        });
      }

      const identifier = email || phone;
      const otp = await OtpService.generateOtp(identifier);

      return res.status(200).json({ 
        success: true,
        message: 'OTP sent for login.' 
      , otp }); // Send OTP back for testing/demo purposes
    } catch (error: any) {
      return res.status(500).json({ 
        success: false,
        message: error.message 
    });
    }
  }

  /**
   * Step 2: Verify OTP for Login
   */
  static async verifyOtpForLogin(req: Request, res: Response) {
    try {
      const { otp, email, phone } = req.body;
      const identifier = email || phone;

      if (!identifier) {
        return res.status(400).json({ 
            success: false,
            message: 'Email or Phone is required.'
        });
      }

      if (!otp) {
        return res.status(400).json({ 
            success: false,
            message: 'OTP is required.' 
        });
      }

      const isOtpValid = await OtpService.verifyOtp(identifier, otp);
      if (!isOtpValid) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid OTP.' 
        });
      }

        const user = await User.findOne({ $or: [{ email }, { phone }] });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
      const authToken = generateAuthToken(user._id.toString());

      return res.status(200).json({
        success: true,
        message: 'Logged in successfully.',
        token: authToken,
        user
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }
}