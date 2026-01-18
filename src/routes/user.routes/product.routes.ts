import { Router } from 'express';
import { 
    getAllProducts
} from '../../controllers/user.controllers/product.controller.js';
import {authenticateUser} from '../../auth/auth.middleware.js';


const router = Router();

router.get('/get-all-products', authenticateUser, getAllProducts);


export default router;
export {};