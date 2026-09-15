import { Router } from "express";
import { authenticateSeller } from "../../auth/auth.middleware.js";
import {
    getSellerOrders,
    getSellerOrderById,
    updateSellerOrderStatus,
} from "../../controllers/seller.controllers/order.controller.js";

const router = Router();

router.get('/', authenticateSeller, getSellerOrders);
router.get('/:orderId', authenticateSeller, getSellerOrderById);
router.patch('/:orderId/status', authenticateSeller, updateSellerOrderStatus);

export default router;
