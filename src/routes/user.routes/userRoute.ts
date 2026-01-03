import { Router } from "express";

const router = Router();

import authRoutes from "./auth.routes.js";
import profileRoutes from "./profile.routes.js";

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);

export default router;
export {};