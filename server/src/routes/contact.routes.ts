import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { createContactMessage } from '../controllers/contact.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';

const router = Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Please wait a moment before sending again.' },
});

router.post('/', contactLimiter, [body('email').isEmail().normalizeEmail()], validate, asyncHandler(createContactMessage));

export default router;
