import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  orgListChallenges, orgCreateChallenge, orgUpdateChallenge, orgDeleteChallenge,
  orgListCatalogue, orgCreateCatalogueItem, orgUpdateCatalogueItem, orgDeleteCatalogueItem,
  orgListRedemptions, orgUpdateRedemption,
} from '../controllers/orgRewards.controller';

// Tenant rewards management — a Company Admin runs their own org's rewards
// programme (on top of MobiCova's global defaults). Admin-only.
const router = Router();
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/challenges', asyncHandler(orgListChallenges));
router.post('/challenges', asyncHandler(orgCreateChallenge));
router.patch('/challenges/:id', asyncHandler(orgUpdateChallenge));
router.delete('/challenges/:id', asyncHandler(orgDeleteChallenge));

router.get('/catalogue', asyncHandler(orgListCatalogue));
router.post('/catalogue', asyncHandler(orgCreateCatalogueItem));
router.patch('/catalogue/:id', asyncHandler(orgUpdateCatalogueItem));
router.delete('/catalogue/:id', asyncHandler(orgDeleteCatalogueItem));

router.get('/redemptions', asyncHandler(orgListRedemptions));
router.patch('/redemptions/:id', asyncHandler(orgUpdateRedemption));

export default router;
