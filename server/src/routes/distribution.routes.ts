import { Router } from 'express';
import { authenticateDistributionPartner } from '../middleware/distributionAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listProducts, quote, createEnrolment, recordPayment, getEnrolment, cancelEnrolment,
} from '../controllers/distribution.controller';

// The Partner Distribution API, mounted at /api/partner/v1. A distribution channel
// (PalmPay, OPay, a telco wallet, an aggregator) sells + services an underwriter's
// plans here, authenticated with a mk_dist_… key. Clean, versioned contract kept
// separate from the internal dashboard API and the read-only public API.
const router = Router();

router.use(asyncHandler(authenticateDistributionPartner));

router.get('/products', asyncHandler(listProducts));
router.post('/quote', asyncHandler(quote));
router.post('/enrolments', asyncHandler(createEnrolment));
router.get('/enrolments/:id', asyncHandler(getEnrolment));
router.post('/enrolments/:id/payment', asyncHandler(recordPayment));
router.post('/enrolments/:id/cancel', asyncHandler(cancelEnrolment));

export default router;
