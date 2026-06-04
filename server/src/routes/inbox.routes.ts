import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getInbox, markInboxRead } from '../controllers/inbox.controller';

const router = Router();

// The action centre is readable by every role; marking read is a light
// per-tenant preference, also open to all roles.
router.use(authenticate);
router.get('/', asyncHandler(getInbox));
router.post('/read', asyncHandler(markInboxRead));

export default router;
