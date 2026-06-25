import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { testSms } from '../controllers/diag.controller';

const router = Router();

// Guarded inside the controller (sandbox-only + shared secret).
router.post('/test-sms', asyncHandler(testSms));

export default router;
