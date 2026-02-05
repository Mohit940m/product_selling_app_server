import { Router } from "express";
import { authenticateUser } from "../../auth/auth.middleware.js";
import {
    addToCart,
    getCart,
    removeFromCart,
} from "../../controllers/user.controllers/cart.controller.js";

const router = Router();

router.post('/add-to-cart', authenticateUser, addToCart);
router.post('/remove-from-cart', authenticateUser, removeFromCart);
router.get('/get-cart', authenticateUser, getCart);

export default router;
export {};