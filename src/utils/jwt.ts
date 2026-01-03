import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();


const JWT_SECRET = process.env.JWT_SECRET;
const REGISTRATION_TOKEN_EXPIRY = '10m'; // Short lived for OTP flow
const AUTH_TOKEN_EXPIRY = '30d';

export interface RegistrationPayload {
  email?: string;
  phone?: string;
  [key: string]: any; // Allow other voluntary fields
}

/**
 * Generates a temporary JWT for the registration flow.
 * Stores all user info (except profileImage) to be persisted after OTP verification.
 */
export const generateRegistrationToken = (payload: RegistrationPayload): string => {
  // Ensure profileImage is not included if passed by accident
  const { profileImage, ...safePayload } = payload;
  
  return jwt.sign(safePayload, JWT_SECRET as string, {
    expiresIn: REGISTRATION_TOKEN_EXPIRY,
  });
};

/**
 * Verifies the registration token and returns the payload.
 */
export const verifyRegistrationToken = (token: string): RegistrationPayload => {
  try {
    return jwt.verify(token, JWT_SECRET as string) as RegistrationPayload;
  } catch (error) {
    throw new Error('Invalid or expired registration token');
  }
};

/**
 * Generates the final authentication JWT for a logged-in user.
 */
export const generateAuthToken = (userId: string): string => {
  return jwt.sign({ id: userId }, JWT_SECRET as string, {
    expiresIn: AUTH_TOKEN_EXPIRY,
  });
};

export const verifyAuthToken = (token: string): any => {
  return jwt.verify(token, JWT_SECRET as string);
};