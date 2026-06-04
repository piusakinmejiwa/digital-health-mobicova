import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getBranding, updateBranding } from '../controllers/branding.controller';

const router = Router();

router.use(authenticate);

// Branding read is open to any role; saving is admin-only.
router.get('/branding', asyncHandler(getBranding));
router.put('/branding', requireRole('admin'), asyncHandler(updateBranding));

export default router;
