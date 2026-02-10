import { Router } from 'express';
import {authenticateUser} from '../../auth/auth.middleware.js';
import {
    getUserProfile,
    editUserProfile,
    addShippingAddress,
} from '../../controllers/user.controllers/profile.controller.js';
import { handleProfileImageUpload } from '../../middlewares/imageUploadHandler.js';

const router = Router();

// User Profile Route
router.get('', authenticateUser,  getUserProfile);

// Edit User Profile Route
router.put('', authenticateUser, handleProfileImageUpload, editUserProfile);

// Add Shipping Address Route
router.post('/address', authenticateUser, addShippingAddress);


export default router;
export {};