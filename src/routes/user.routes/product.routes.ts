import { Router } from 'express';
import { 
    getAllProducts,
    getProductById,
} from '../../controllers/user.controllers/product.controller.js';
import {authenticateUser} from '../../auth/auth.middleware.js';


const router = Router();

router.get('/get-all-products', authenticateUser, getAllProducts);
router.get('/get-product/:productId', authenticateUser, getProductById);


export default router;
export {};