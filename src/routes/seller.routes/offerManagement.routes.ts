import { Router } from 'express';
import {
    createOffer
} from '../../controllers/seller.controllers/offerManagement.controller.js';

import {authenticateSeller} from '../../auth/auth.middleware.js';

const router = Router();

router.post('/create-offer', authenticateSeller, createOffer);

export default router;
export {};