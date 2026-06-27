import { Router } from 'express';
import { 
    getAllProducts,
    getProductById,
} from '../../controllers/user.controllers/product.controller.js';
import { optionalAuthUser } from '../../auth/auth.middleware.js';


const router = Router();

router.get('/get-all-products', optionalAuthUser, getAllProducts);
router.get('/get-product/:productId', optionalAuthUser, getProductById);


export default router;
export {};