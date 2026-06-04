import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { handleStripeWebhook, handlePaystackWebhook } from '../controllers/billing.controller';
import { getBillingAccount, changePlan } from '../controllers/billingAccount.controller';

const router = Router();

// No `authenticate` — payment providers call these endpoints directly.
// Authenticity is established by verifying the provider's signature over the raw
// request body, not a user JWT.
router.post('/stripe/webhook', asyncHandler(handleStripeWebhook));
router.post('/paystack/webhook', asyncHandler(handlePaystackWebhook));

// Authenticated billing account: plan, usage, invoices. Read open to any role;
// changing plan is admin-only.
router.get('/account', authenticate, asyncHandler(getBillingAccount));
router.post(
  '/account/plan',
  authenticate,
  requireRole('admin'),
  [body('tier').trim().notEmpty()],
  validate,
  asyncHandler(changePlan)
);

export default router;
