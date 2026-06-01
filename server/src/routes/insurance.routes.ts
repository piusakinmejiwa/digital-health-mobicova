import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listPlans, listEnrolments, enrolMember, createPremiumCheckout,
} from '../controllers/insurance.controller';

const router = Router();

router.use(authenticate);

router.get('/plans', asyncHandler(listPlans));
router.get('/enrolments', asyncHandler(listEnrolments));
router.post(
  '/enrolments',
  [body('memberId').notEmpty(), body('planId').notEmpty()],
  validate,
  asyncHandler(enrolMember)
);
router.post('/enrolments/:id/checkout', asyncHandler(createPremiumCheckout));

export default router;
