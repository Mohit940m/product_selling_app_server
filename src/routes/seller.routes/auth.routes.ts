import { Router } from 'express';
import { AuthController } from '../../controllers/seller.controllers/auth.controller.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: The user's email address.
 */

// Registration Flow
/**
 * @swagger
 * /api/v1/seller/register:
 *   post:
 *     tags:
 *       - Sellers
 *     summary: Register a new seller
 *     description: Endpoint to register a new seller. Sends an OTP to the seller's email for verification.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       '200':
 *         description: Registration successful, OTP sent to email.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Registration successful, OTP sent to email.
 */
router.post('/register', AuthController.registerSeller);

// Verify OTP for Registration
/**
 * @swagger
 * /api/v1/seller/verify-registration:
 *   post:
 *     tags:
 *       - Sellers
 *     summary: Verify OTP for registration
 *     description: Endpoint to verify the OTP sent during seller registration.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The user's email address.
 *               otp:
 *                 type: string
 *                 description: The OTP sent to the user's email.
 *     responses:
 *       '200':
 *         description: OTP verified successfully.
 */
router.post('/verify-registration', AuthController.verifyOtpForRegistration);

// Login Flow
router.post('/login', AuthController.loginSeller);
router.post('/verify-login', AuthController.verifyOtpForLogin);

export default router;