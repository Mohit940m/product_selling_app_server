import { Router } from 'express';
import { 
    createProduct, 
    editProduct,
    editProductStatus,
    increaseStock,
    editVariantPrice,
    editVariantStatus,
    getAllProducts,
    getProductById,
    addVariant,
    deleteProduct,
    deleteProductPermanent,
} from '../../controllers/seller.controllers/product.controller.js';
import {authenticateSeller} from '../../auth/auth.middleware.js';
import { handleProductImageUpload } from "../../middlewares/imageUploadHandler.js";


const router = Router();

router.post('/create-product', authenticateSeller, handleProductImageUpload, createProduct);
router.put('/edit-product/:productId', authenticateSeller, handleProductImageUpload, editProduct);
router.patch('/edit-product-status/:productId', authenticateSeller, editProductStatus);
router.patch('/increase-stock/:productId', authenticateSeller, increaseStock);
router.patch('/edit-variant-price/:productId', authenticateSeller, editVariantPrice);
router.patch('/edit-variant-status/:productId', authenticateSeller, editVariantStatus);
router.get('/get-all-products', authenticateSeller, getAllProducts);
router.get('/get-product/:productId', authenticateSeller, getProductById);
router.post('/add-variant/:productId', authenticateSeller, addVariant);
router.delete('/delete-product/:productId', authenticateSeller, deleteProduct);
router.delete('/delete-product-permanent/:productId', authenticateSeller, deleteProductPermanent);

export default router;
export {};