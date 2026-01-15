import { Router } from 'express';
import { createProduct, editProduct } from '../../controllers/seller.controllers/product.controller.js';
import {authenticateSeller} from '../../auth/auth.middleware.js';
import { handleProductImageUpload } from "../../middlewares/imageUploadHandler.js";


const router = Router();

router.post('/create-product', authenticateSeller, handleProductImageUpload, createProduct);
router.put('/edit-product/:productId', authenticateSeller, handleProductImageUpload, editProduct);

export default router;
export {};