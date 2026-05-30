import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  listPlans, listEnrolments, enrolMember, createPremiumCheckout,
} from '../controllers/insurance.controller';

const router = Router();

router.use(authenticate);

router.get('/plans', listPlans);
router.get('/enrolments', listEnrolments);
router.post(
  '/enrolments',
  [body('memberId').notEmpty(), body('planId').notEmpty()],
  validate,
  enrolMember
);
router.post('/enrolments/:id/checkout', createPremiumCheckout);

export default router;
