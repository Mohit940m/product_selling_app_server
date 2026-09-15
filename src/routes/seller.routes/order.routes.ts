import { Router } from "express";
import { authenticateSeller } from "../../auth/auth.middleware.js";
import {
    getSellerOrders,
    getSellerOrderById,
    updateSellerOrderItemStatus,
} from "../../controllers/seller.controllers/order.controller.js";

const router = Router();

router.get('/', authenticateSeller, getSellerOrders);
router.get('/:orderId', authenticateSeller, getSellerOrderById);
router.patch('/:orderId/items/:subOrderId/status', authenticateSeller, updateSellerOrderItemStatus);

export default router;
