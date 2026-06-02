import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireWrite } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listTriageSessions, getTriageSession, sendTriageMessage,
} from '../controllers/triage.controller';

const router = Router();

router.use(authenticate);

// Reading past triage sessions is open to all roles; running a new triage
// (which writes a session) requires write access (admin or manager).
router.get('/', asyncHandler(listTriageSessions));
router.get('/:id', asyncHandler(getTriageSession));
router.post(
  '/message',
  requireWrite,
  [body('message').trim().notEmpty().withMessage('message is required')],
  validate,
  asyncHandler(sendTriageMessage)
);

export default router;
