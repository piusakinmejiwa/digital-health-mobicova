import { Router } from 'express';
import { authenticate, requireWrite } from '../middleware/auth';
import { requireOrgType } from '../middleware/orgCapability';
import { asyncHandler } from '../middleware/asyncHandler';
import { listChildEmployers, createChildEmployer } from '../controllers/hierarchy.controller';

// HMO / insurer onboarding console — manage the employer orgs beneath this org.
// Restricted to the aggregator tiers (hmo, underwriter).
const router = Router();

router.use(authenticate);
router.use(asyncHandler(requireOrgType('hmo', 'underwriter')));

router.get('/employers', asyncHandler(listChildEmployers));
router.post('/employers', requireWrite, asyncHandler(createChildEmployer));

export default router;
