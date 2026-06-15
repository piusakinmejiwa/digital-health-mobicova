import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { listOrgActivity } from '../controllers/orgAudit.controller';

// Partner-facing activity log — each org admin sees their OWN organisation's
// audit trail (a scoped subset of the platform-admin /admin/audit).
const router = Router();

router.get('/', authenticate, asyncHandler(listOrgActivity));

export default router;
