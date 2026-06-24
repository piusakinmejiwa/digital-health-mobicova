import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { handleUssd, handleUssdNotification } from '../controllers/ussd.controller';
import {
  verifyWhatsapp, handleWhatsappWebhook, simulateWhatsapp,
} from '../controllers/whatsapp.controller';

const router = Router();

// Public, provider-facing endpoints — no dashboard JWT. The telco aggregator
// (USSD) and Meta (WhatsApp) call these directly. Member creation still requires
// a valid organisation join code, which gates who can be enrolled.
router.post('/ussd', asyncHandler(handleUssd));
// Optional: AT end-of-session notification (second callback URL on the service code).
router.post('/ussd/notification', asyncHandler(handleUssdNotification));

router.get('/whatsapp/webhook', asyncHandler(verifyWhatsapp));
router.post('/whatsapp/webhook', asyncHandler(handleWhatsappWebhook));

// Local simulator for the in-app Channels page (no Meta account needed).
router.post('/whatsapp/simulate', asyncHandler(simulateWhatsapp));

export default router;
