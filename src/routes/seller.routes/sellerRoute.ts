import { Router } from "express";

const router = Router();

import authRoutes from "./auth.routes.js";
import productRoutes from "./product.routes.js";
import shippingRoutes from "./shipping.routes.js";
import offerManagementRoutes from "./offerManagement.routes.js";
import orderRoutes from "./order.routes.js";
import checkoutRoutes from "./checkout.routes.js";

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/shipping", shippingRoutes);
router.use("/offers", offerManagementRoutes);
router.use("/orders", orderRoutes);
router.use("/checkouts", checkoutRoutes);

export default router;
export {};