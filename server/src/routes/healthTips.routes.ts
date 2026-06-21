import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  subscribeHealthTips, unsubscribeHealthTips, runDailyTips,
} from '../controllers/healthTips.controller';

// Public Daily Health Tips: registration, unsubscribe, and the cron trigger.
const router = Router();

router.post('/subscribe', asyncHandler(subscribeHealthTips));
router.post('/unsubscribe', asyncHandler(unsubscribeHealthTips));
router.get('/unsubscribe', asyncHandler(unsubscribeHealthTips));
// Fired by an external scheduler (guarded by HEALTH_TIPS_CRON_SECRET).
router.post('/run-daily', asyncHandler(runDailyTips));

export default router;
