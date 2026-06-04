import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { createLead } from '../controllers/leads.controller';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Public + unauthenticated, so it gets its own tight limiter against spam.
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

router.post('/', leadLimiter, [body('email').isEmail().normalizeEmail()], validate, asyncHandler(createLead));

export default router;
