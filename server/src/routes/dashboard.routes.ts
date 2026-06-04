import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getDashboard, dismissOnboarding } from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);
router.get('/', asyncHandler(getDashboard));
router.post('/onboarding/dismiss', asyncHandler(dismissOnboarding));

export default router;
