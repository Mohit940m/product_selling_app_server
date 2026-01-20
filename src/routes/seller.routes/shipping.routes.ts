import { Router } from 'express';

import { 
    createShippingConfig,
    getShippingConfig,
    updateShippingConfig,
    calculateShippingCost
} from '../../controllers/seller.controllers/shipping.controller.js';
import { authenticateSeller } from '../../auth/auth.middleware.js';

const router = Router();

router.get('/get-shipping-config', authenticateSeller, getShippingConfig);

router.post('/create-shipping-config', authenticateSeller, createShippingConfig);

router.put('/update-shipping-config', authenticateSeller, updateShippingConfig);

router.post('/calculate-shipping-cost', authenticateSeller, calculateShippingCost);


export default router;
export {};

//# sourceMappingURL=shipping.routes.js.map