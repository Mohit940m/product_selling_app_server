import { Router } from "express";
import { authenticateUser } from "../../auth/auth.middleware.js";
import {
    checkout,
    createOrder,
    verifyPayment,
} from "../../controllers/user.controllers/order.controller.js";

const router = Router();

router.post('/checkout', authenticateUser, checkout);
router.post('/create-order', authenticateUser, createOrder);
router.post('/verify-payment', authenticateUser, verifyPayment);

export default router;
export {};