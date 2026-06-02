import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getMySso, updateMySso } from '../controllers/sso.controller';

// Org-admin self-service SSO configuration. Reading the config is open to any
// signed-in admin; only org admins may change it (managers/analysts cannot).
const router = Router();

router.use(authenticate);
router.get('/config', requireRole('admin'), asyncHandler(getMySso));
router.put('/config', requireRole('admin'), asyncHandler(updateMySso));

export default router;
