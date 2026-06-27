import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getDashboard, dismissOnboarding } from '../controllers/dashboard.controller';
import { getAccountHealth } from '../controllers/accountHealth.controller';

const router = Router();

router.use(authenticate);
router.get('/', asyncHandler(getDashboard));
router.get('/account-health', asyncHandler(getAccountHealth));
router.post('/onboarding/dismiss', asyncHandler(dismissOnboarding));

export default router;
