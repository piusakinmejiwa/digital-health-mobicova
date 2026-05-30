import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  listTriageSessions, getTriageSession, sendTriageMessage,
} from '../controllers/triage.controller';

const router = Router();

router.use(authenticate);

router.get('/', listTriageSessions);
router.get('/:id', getTriageSession);
router.post(
  '/message',
  [body('message').trim().notEmpty().withMessage('message is required')],
  validate,
  sendTriageMessage
);

export default router;
