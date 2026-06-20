import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { createNewsletterSignup } from '../controllers/newsletter.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Please wait a moment before trying again.' },
});

router.post('/', limiter, [body('email').isEmail().normalizeEmail()], validate, asyncHandler(createNewsletterSignup));

export default router;
