import { Router } from 'express';
import { body } from 'express-validator';
import {
  providerLogin, providerLogoutAll, providerForgotPassword, providerResetPassword, getProviderMe,
  listProviderConsultations, getProviderConsultation, acceptConsultation,
  providerConsultationCall, getConsultationRecording, getIncomingCalls,
  updateProviderConsultation, addProviderPrescription, listPharmacies,
  listProviderPrescriptions, advancePrescription,
} from '../controllers/provider.controller';
import { authenticateProvider, requireProviderRole } from '../middleware/providerAuth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Public auth.
router.post(
  '/auth/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  asyncHandler(providerLogin)
);

router.post('/auth/forgot-password', [body('email').isEmail().normalizeEmail()], validate, asyncHandler(providerForgotPassword));
router.post(
  '/auth/reset-password',
  [body('token').notEmpty(), body('password').isLength({ min: 12 })],
  validate,
  asyncHandler(providerResetPassword)
);
router.post('/auth/logout-all', authenticateProvider, asyncHandler(providerLogoutAll));
router.get('/me', authenticateProvider, asyncHandler(getProviderMe));

// Doctor — consultations.
const doctorOnly = [authenticateProvider, requireProviderRole('doctor')];
router.get('/consultations', doctorOnly, asyncHandler(listProviderConsultations));
router.get('/incoming-calls', doctorOnly, asyncHandler(getIncomingCalls));
router.get('/consultations/:id', doctorOnly, asyncHandler(getProviderConsultation));
router.post('/consultations/:id/accept', doctorOnly, asyncHandler(acceptConsultation));
router.post('/consultations/:id/call', doctorOnly, asyncHandler(providerConsultationCall));
router.get('/consultations/:id/recording', doctorOnly, asyncHandler(getConsultationRecording));
router.patch('/consultations/:id', doctorOnly, asyncHandler(updateProviderConsultation));
router.get('/pharmacies', doctorOnly, asyncHandler(listPharmacies));
router.post(
  '/consultations/:id/prescriptions',
  doctorOnly,
  [body('medication').trim().notEmpty()],
  validate,
  asyncHandler(addProviderPrescription)
);

// Pharmacist — dispensary.
const pharmacistOnly = [authenticateProvider, requireProviderRole('pharmacist')];
router.get('/prescriptions', pharmacistOnly, asyncHandler(listProviderPrescriptions));
router.patch('/prescriptions/:id/advance', pharmacistOnly, [body('status').trim().notEmpty()], validate, asyncHandler(advancePrescription));

export default router;
