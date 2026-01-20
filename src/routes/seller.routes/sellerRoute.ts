import { Router } from "express";

const router = Router();

import authRoutes from "./auth.routes.js";
import productRoutes from "./product.routes.js";
import shippingRoutes from "./shipping.routes.js";

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/shipping", shippingRoutes);

export default router;
export {};