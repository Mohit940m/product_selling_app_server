import { Router } from 'express';
import { 
    createProduct, 
    editProduct,
    editProductStatus,
    increaseStock,
    getAllProducts,
} from '../../controllers/seller.controllers/product.controller.js';
import {authenticateSeller} from '../../auth/auth.middleware.js';
import { handleProductImageUpload } from "../../middlewares/imageUploadHandler.js";


const router = Router();

router.post('/create-product', authenticateSeller, handleProductImageUpload, createProduct);
router.put('/edit-product/:productId', authenticateSeller, handleProductImageUpload, editProduct);
router.patch('/edit-product-status/:productId', authenticateSeller, editProductStatus);
router.patch('/increase-stock/:productId', authenticateSeller, increaseStock);
router.get('/get-all-products', authenticateSeller, getAllProducts);

export default router;
export {};