import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getPlatformStatus } from '../controllers/status.controller';

// Public platform status — no auth (powers the public /status page).
const router = Router();
router.get('/', asyncHandler(getPlatformStatus));
export default router;
