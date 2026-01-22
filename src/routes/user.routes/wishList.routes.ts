import { Router } from 'express';
import { 
    addProductToWishList,
} from '../../controllers/user.controllers/wishList.controller.js';
import { authenticateUser } from '../../auth/auth.middleware.js';

const router = Router();

router.post('/add', authenticateUser, addProductToWishList);

export default router;
export {};

