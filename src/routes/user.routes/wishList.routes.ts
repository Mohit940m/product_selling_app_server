import { Router } from 'express';
import {
    addProductToWishList,
    removeProductFromWishList,
    getWishList,
} from '../../controllers/user.controllers/wishList.controller.js';
import { authenticateUser } from '../../auth/auth.middleware.js';

const router = Router();

router.post('/add', authenticateUser, addProductToWishList);
router.delete('/remove/:productId', authenticateUser, removeProductFromWishList);
router.get('/', authenticateUser, getWishList);

export default router;
export {};

