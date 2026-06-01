import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listTriageSessions, getTriageSession, sendTriageMessage,
} from '../controllers/triage.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listTriageSessions));
router.get('/:id', asyncHandler(getTriageSession));
router.post(
  '/message',
  [body('message').trim().notEmpty().withMessage('message is required')],
  validate,
  asyncHandler(sendTriageMessage)
);

export default router;
