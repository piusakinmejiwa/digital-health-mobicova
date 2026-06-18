import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { createProspectFeedback } from '../controllers/prospectFeedback.controller';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Public + unauthenticated, so it gets its own tight limiter against spam.
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

router.post('/', feedbackLimiter, [body('email').isEmail().normalizeEmail()], validate, asyncHandler(createProspectFeedback));

export default router;
