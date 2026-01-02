import { Router } from 'express';
import { AuthController } from '../../controllers/user.controllers/auth.controller.js';

const router = Router();

// Registration Flow
router.post('/register', AuthController.registerUser);
router.post('/verify-registration', AuthController.verifyOtpForRegistration);

// Login Flow
router.post('/login', AuthController.loginUser);
router.post('/verify-login', AuthController.verifyOtpForLogin);

export default router;