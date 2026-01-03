import { Router } from 'express';
import authenticateUser from '../../auth/auth.middleware.js';
import {
    getUserProfile,
} from '../../controllers/user.controllers/profile.controller.js';

const router = Router();

// User Profile Route
router.get('', authenticateUser,  getUserProfile);


export default router;
export {};