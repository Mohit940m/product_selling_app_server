import { Router } from "express";
import { authenticateUser } from "../../auth/auth.middleware.js";
import {
    addToCart,
    getCart,
} from "../../controllers/user.controllers/cart.controller.js";

const router = Router();

router.post('/add-to-cart', authenticateUser, addToCart);
router.get('/get-cart', authenticateUser, getCart);

export default router;
export {};