import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getAnalytics } from '../controllers/analytics.controller';

const router = Router();

// Read-only reporting — open to every role (incl. analysts).
router.use(authenticate);
router.get('/', asyncHandler(getAnalytics));

export default router;
