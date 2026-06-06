import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import {
  requestOtp, verifyOtp, getMemberMe, getMemberOverview,
  listMemberClaims, getMemberClaim, createMemberClaim, memberTriage, createMemberConsultation,
  getMemberDoctors,
} from '../controllers/memberPortal.controller';
import { authenticateMember } from '../middleware/memberAuth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// OTP endpoints are unauthenticated and send/check secrets, so they get a
// tighter limiter than the general API to blunt guessing / SMS-pumping.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

// --- Passwordless auth (public) ---
router.post('/auth/request-otp', otpLimiter, [body('identifier').trim().notEmpty()], validate, asyncHandler(requestOtp));
router.post('/auth/verify-otp', otpLimiter, [body('identifier').trim().notEmpty(), body('code').trim().notEmpty()], validate, asyncHandler(verifyOtp));

// --- Authenticated member portal ---
router.get('/me', authenticateMember, asyncHandler(getMemberMe));
router.get('/overview', authenticateMember, asyncHandler(getMemberOverview));
router.get('/doctors', authenticateMember, asyncHandler(getMemberDoctors));
router.get('/claims', authenticateMember, asyncHandler(listMemberClaims));
router.get('/claims/:id', authenticateMember, asyncHandler(getMemberClaim));
router.post('/claims', authenticateMember, [body('amount').notEmpty()], validate, asyncHandler(createMemberClaim));
router.post('/triage', authenticateMember, [body('message').trim().notEmpty()], validate, asyncHandler(memberTriage));
router.post('/consultations', authenticateMember, asyncHandler(createMemberConsultation));

export default router;
