import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getBranding, updateBranding } from '../controllers/branding.controller';
import { getCompliance, acceptDpa, requestDataExport } from '../controllers/compliance.controller';

const router = Router();

router.use(authenticate);

// Branding read is open to any role; saving is admin-only.
router.get('/branding', asyncHandler(getBranding));
router.put('/branding', requireRole('admin'), asyncHandler(updateBranding));

// Tenant compliance — read open to any role; DPA acceptance + data-export
// requests are admin-only (they bind/commit the organisation).
router.get('/compliance', asyncHandler(getCompliance));
router.post('/compliance/dpa/accept', requireRole('admin'), asyncHandler(acceptDpa));
router.post('/compliance/data-export', requireRole('admin'), asyncHandler(requestDataExport));

export default router;
