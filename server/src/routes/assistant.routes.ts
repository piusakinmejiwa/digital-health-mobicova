import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { assistantChat } from '../controllers/assistant.controller';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Public + unauthenticated site assistant. Coarse anti-spam limiter.
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down a moment, then try again.' },
});

router.post('/chat', assistantLimiter, asyncHandler(assistantChat));

export default router;
