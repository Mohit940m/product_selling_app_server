import { Router } from "express";
import { authenticateUser } from "../../auth/auth.middleware.js";
import {
    checkout,
} from "../../controllers/user.controllers/order.controller.js";

const router = Router();

router.post('/checkout', authenticateUser, checkout);

export default router;
export {};