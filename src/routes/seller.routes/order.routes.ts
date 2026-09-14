import { Router } from "express";
import { authenticateSeller } from "../../auth/auth.middleware.js";
import { getSellerOrders, getSellerOrderById } from "../../controllers/seller.controllers/order.controller.js";

const router = Router();

router.get('/', authenticateSeller, getSellerOrders);
router.get('/:orderId', authenticateSeller, getSellerOrderById);

export default router;
