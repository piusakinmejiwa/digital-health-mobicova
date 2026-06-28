import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getBranding, updateBranding, uploadBrandingLogo } from '../controllers/branding.controller';
import { getCompliance, acceptDpa, requestDataExport } from '../controllers/compliance.controller';

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

const router = Router();

router.use(authenticate);

// Branding read is open to any role; saving + logo upload are admin-only.
router.get('/branding', asyncHandler(getBranding));
router.put('/branding', requireRole('admin'), asyncHandler(updateBranding));
router.post('/branding/logo', requireRole('admin'), imageUpload.single('image'), asyncHandler(uploadBrandingLogo));

// Tenant compliance — read open to any role; DPA acceptance + data-export
// requests are admin-only (they bind/commit the organisation).
router.get('/compliance', asyncHandler(getCompliance));
router.post('/compliance/dpa/accept', requireRole('admin'), asyncHandler(acceptDpa));
router.post('/compliance/data-export', requireRole('admin'), asyncHandler(requestDataExport));

export default router;
