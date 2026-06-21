import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { voiceCallback, voiceEvent } from '../controllers/voice.controller';

// Public masking-call webhooks. The voice provider posts here (Africa's Talking
// via dashboard-registered URLs; Twilio via the Url/StatusCallback we pass at
// originate time). No gateway auth token, optionally guarded by ?token=AT_WEBHOOK_TOKEN.
const router = Router();

router.post('/callback', asyncHandler(voiceCallback));
router.post('/event', asyncHandler(voiceEvent));

export default router;
