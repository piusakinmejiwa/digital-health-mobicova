import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { handleStripeWebhook, handlePaystackWebhook } from '../controllers/billing.controller';

const router = Router();

// No `authenticate` — payment providers call these endpoints directly.
// Authenticity is established by verifying the provider's signature over the raw
// request body, not a user JWT.
router.post('/stripe/webhook', asyncHandler(handleStripeWebhook));
router.post('/paystack/webhook', asyncHandler(handlePaystackWebhook));

export default router;
