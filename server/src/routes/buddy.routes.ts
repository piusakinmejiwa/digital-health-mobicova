import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { buddyChat } from '../controllers/buddy.controller';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Public + unauthenticated (free buddy). Coarse anti-spam limiter; the real
// per-user daily cap (20/day) is enforced in the controller.
const buddyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down a moment, then try again.' },
});

router.post('/chat', buddyLimiter, asyncHandler(buddyChat));

export default router;
