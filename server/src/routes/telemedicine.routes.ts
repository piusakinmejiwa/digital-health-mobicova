import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listConsultations, getConsultation, bookConsultation, updateConsultation, addPrescription,
} from '../controllers/telemedicine.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listConsultations));
router.get('/:id', asyncHandler(getConsultation));
router.post(
  '/',
  [body('memberId').notEmpty().withMessage('memberId is required')],
  validate,
  asyncHandler(bookConsultation)
);
router.put('/:id', asyncHandler(updateConsultation));
router.post(
  '/:id/prescriptions',
  [body('medication').trim().notEmpty().withMessage('medication is required')],
  validate,
  asyncHandler(addPrescription)
);

export default router;
