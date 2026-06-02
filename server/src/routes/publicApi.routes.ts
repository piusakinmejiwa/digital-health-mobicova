import { Router } from 'express';
import {
  listMembers, getMember, listEnrolments, listClaims, getClaim,
} from '../controllers/publicApi.controller';
import { authenticateApiKey } from '../middleware/apiKeyAuth';
import { asyncHandler } from '../middleware/asyncHandler';

// The public, API-key-authenticated REST surface. Mounted at /api/public/v1 so
// it has its own clean, versioned contract separate from the internal /api/v1
// the dashboard uses.
const router = Router();

router.use(asyncHandler(authenticateApiKey));

router.get('/members', asyncHandler(listMembers));
router.get('/members/:id', asyncHandler(getMember));
router.get('/enrolments', asyncHandler(listEnrolments));
router.get('/claims', asyncHandler(listClaims));
router.get('/claims/:id', asyncHandler(getClaim));

export default router;
