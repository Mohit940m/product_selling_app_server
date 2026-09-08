import { Router } from 'express';
import {
    createOffer,
    getSellerOffers,
    editOfferStatus,
    deleteOffer
} from '../../controllers/seller.controllers/offerManagement.controller.js';

import {authenticateSeller} from '../../auth/auth.middleware.js';

const router = Router();

router.post('/create-offer', authenticateSeller, createOffer);
router.get('/', authenticateSeller, getSellerOffers);
router.patch('/edit-offer-status/:offerId', authenticateSeller, editOfferStatus);
router.delete('/delete-offer/:offerId', authenticateSeller, deleteOffer);

export default router;
export {};