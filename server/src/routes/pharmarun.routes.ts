import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { pharmarunWebhook } from '../controllers/pharmarun.controller';

// Public PharmaRun fulfilment webhook (order status updates). Register this URL
// in the PharmaRun dashboard: <SERVER_URL>/api/v1/pharmarun/webhook
const router = Router();

router.post('/webhook', asyncHandler(pharmarunWebhook));

export default router;
