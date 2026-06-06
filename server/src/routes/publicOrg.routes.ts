import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getPublicOrgBranding } from '../controllers/publicOrg.controller';

// Public, unauthenticated org lookups (branded login pages).
const router = Router();

router.get('/:slug/branding', asyncHandler(getPublicOrgBranding));

export default router;
