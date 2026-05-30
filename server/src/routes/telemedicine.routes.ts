import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  listConsultations, getConsultation, bookConsultation, updateConsultation, addPrescription,
} from '../controllers/telemedicine.controller';

const router = Router();

router.use(authenticate);

router.get('/', listConsultations);
router.get('/:id', getConsultation);
router.post(
  '/',
  [body('memberId').notEmpty().withMessage('memberId is required')],
  validate,
  bookConsultation
);
router.put('/:id', updateConsultation);
router.post(
  '/:id/prescriptions',
  [body('medication').trim().notEmpty().withMessage('medication is required')],
  validate,
  addPrescription
);

export default router;
