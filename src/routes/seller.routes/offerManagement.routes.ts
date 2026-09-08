import { Router } from 'express';
import {
    createOffer,
    getSellerOffers
} from '../../controllers/seller.controllers/offerManagement.controller.js';

import {authenticateSeller} from '../../auth/auth.middleware.js';

const router = Router();

router.post('/create-offer', authenticateSeller, createOffer);
router.get('/', authenticateSeller, getSellerOffers);

export default router;
export {};