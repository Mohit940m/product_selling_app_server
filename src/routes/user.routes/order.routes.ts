import { Router } from "express";
import { authenticateUser } from "../../auth/auth.middleware.js";
import {
    checkout,
    createOrder,
    verifyPayment,
    getMyOrders,
    getMyOrderById,
    cancelOrderItem,
} from "../../controllers/user.controllers/order.controller.js";

const router = Router();

router.post('/checkout', authenticateUser, checkout);
router.post('/create-order', authenticateUser, createOrder);
router.post('/verify-payment', authenticateUser, verifyPayment);
router.get('/', authenticateUser, getMyOrders);
router.get('/:orderId', authenticateUser, getMyOrderById);
router.patch('/:orderId/items/:subOrderId/cancel', authenticateUser, cancelOrderItem);

export default router;
export {};