import { Router } from "express";

const router = Router();

import authRoutes from "./auth.routes.js";
import profileRoutes from "./profile.routes.js";
import productRoutes from "./product.routes.js";
import wishListRoutes from "./wishList.routes.js";

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/products", productRoutes);
router.use("/wishlist", wishListRoutes);

export default router;
export {};