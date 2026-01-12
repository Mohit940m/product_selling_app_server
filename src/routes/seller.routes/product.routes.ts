import { Router } from 'express';
import { createProduct } from '../../controllers/seller.controllers/product.controller.js';
import {authenticateSeller} from '../../auth/auth.middleware.js';


const router = Router();

router.post('/create-product', authenticateSeller,  createProduct);

export default router;
export {};