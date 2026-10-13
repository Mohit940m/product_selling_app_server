import { Router } from "express";
import { authenticateSeller } from "../../auth/auth.middleware.js";
import { getSellerCheckouts } from "../../controllers/seller.controllers/checkout.controller.js";

const router = Router();

/**
 * @swagger
 * /api/v1/seller/checkouts:
 *   get:
 *     summary: Buyers who reached checkout with this seller's products
 *     description: >
 *       Logged-in buyers who opened checkout (storefront or AI assistant), with their
 *       name/email/phone where available and only this seller's items. NOT_PLACED
 *       sessions never reached a paid order; COMPLETED ones did.
 *     tags: [Seller Checkouts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [not_placed, completed, all], default: not_placed }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Checkout sessions plus notPlaced/completed counts
 *       400:
 *         description: Invalid status filter
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateSeller, getSellerCheckouts);

export default router;
