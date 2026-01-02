import { Router } from "express";

const router = Router();

import authRoutes from "./auth.routes.js";

router.use("/auth", authRoutes);

export default router;
export {};