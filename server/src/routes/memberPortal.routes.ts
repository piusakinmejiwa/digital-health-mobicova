import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import {
  requestOtp, verifyOtp, getMemberMe, getMemberOverview,
  listMemberClaims, getMemberClaim, createMemberClaim, memberTriage, createMemberConsultation,
  startMemberConsultation, completeMemberConsultation, startMemberPhoneCall,
  updateMemberLocation, getMemberDoctors, setPrescriptionFulfilment,
  getMemberRewardsHandler, getMemberChallengesHandler,
  getMemberLeaderboardHandler, setMemberLeaderboardOptIn,
  getMemberCatalogue, redeemReward, getMemberRedemptionsHandler,
  memberLogoutAll,
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
router.post('/auth/logout-all', authenticateMember, asyncHandler(memberLogoutAll));
router.get('/me', authenticateMember, asyncHandler(getMemberMe));
router.get('/overview', authenticateMember, asyncHandler(getMemberOverview));
router.get('/doctors', authenticateMember, asyncHandler(getMemberDoctors));
router.get('/rewards', authenticateMember, asyncHandler(getMemberRewardsHandler));
router.get('/challenges', authenticateMember, asyncHandler(getMemberChallengesHandler));
router.get('/leaderboard', authenticateMember, asyncHandler(getMemberLeaderboardHandler));
router.post('/leaderboard/opt-in', authenticateMember, asyncHandler(setMemberLeaderboardOptIn));
router.get('/rewards/catalogue', authenticateMember, asyncHandler(getMemberCatalogue));
router.post('/rewards/redeem', authenticateMember, asyncHandler(redeemReward));
router.get('/rewards/redemptions', authenticateMember, asyncHandler(getMemberRedemptionsHandler));
router.get('/claims', authenticateMember, asyncHandler(listMemberClaims));
router.get('/claims/:id', authenticateMember, asyncHandler(getMemberClaim));
router.post('/claims', authenticateMember, [body('amount').notEmpty()], validate, asyncHandler(createMemberClaim));
router.post('/triage', authenticateMember, [body('message').trim().notEmpty()], validate, asyncHandler(memberTriage));
router.post('/consultations', authenticateMember, asyncHandler(createMemberConsultation));
router.post('/consultations/start', authenticateMember, asyncHandler(startMemberConsultation));
router.post('/consultations/:id/complete', authenticateMember, asyncHandler(completeMemberConsultation));
router.post('/consultations/phone-call', authenticateMember, asyncHandler(startMemberPhoneCall));
router.patch('/profile/location', authenticateMember, asyncHandler(updateMemberLocation));
router.post('/prescriptions/:id/fulfilment', authenticateMember, [body('method').trim().notEmpty()], validate, asyncHandler(setPrescriptionFulfilment));

export default router;
