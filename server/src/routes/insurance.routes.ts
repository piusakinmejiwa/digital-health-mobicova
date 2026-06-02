import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireWrite } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listPlans, listEnrolments, enrolMember, createPremiumCheckout,
} from '../controllers/insurance.controller';

const router = Router();

router.use(authenticate);

// Catalog and enrolment reads open to all roles; enrolling a member and
// starting a premium checkout require write access (admin or manager).
router.get('/plans', asyncHandler(listPlans));
router.get('/enrolments', asyncHandler(listEnrolments));
router.post(
  '/enrolments',
  requireWrite,
  [body('memberId').notEmpty(), body('planId').notEmpty()],
  validate,
  asyncHandler(enrolMember)
);
router.post('/enrolments/:id/checkout', requireWrite, asyncHandler(createPremiumCheckout));

export default router;
