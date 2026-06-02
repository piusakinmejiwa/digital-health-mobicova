import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireWrite } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listConsultations, getConsultation, bookConsultation, updateConsultation, addPrescription,
} from '../controllers/telemedicine.controller';

const router = Router();

router.use(authenticate);

// Reads open to all roles; booking, updating and prescribing require write
// access (admin or manager).
router.get('/', asyncHandler(listConsultations));
router.get('/:id', asyncHandler(getConsultation));
router.post(
  '/',
  requireWrite,
  [body('memberId').notEmpty().withMessage('memberId is required')],
  validate,
  asyncHandler(bookConsultation)
);
router.put('/:id', requireWrite, asyncHandler(updateConsultation));
router.post(
  '/:id/prescriptions',
  requireWrite,
  [body('medication').trim().notEmpty().withMessage('medication is required')],
  validate,
  asyncHandler(addPrescription)
);

export default router;
