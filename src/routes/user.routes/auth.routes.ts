import { Router } from 'express';
import { AuthController } from '../../controllers/user.controllers/auth.controller.js';

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
 * /api/v1/user/register:
 *   post:
 *     tags:
 *       - Users
 *     summary: Register a new user
 *     description: Endpoint to register a new user. Sends an OTP to the user's email for verification.
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
router.post('/register', AuthController.registerUser);


router.post('/verify-registration', AuthController.verifyOtpForRegistration);

// Login Flow
router.post('/login', AuthController.loginUser);
router.post('/verify-login', AuthController.verifyOtpForLogin);

export default router;