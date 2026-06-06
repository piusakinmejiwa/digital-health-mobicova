import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrgClass } from '../middleware/orgCapability';
import { asyncHandler } from '../middleware/asyncHandler';
import { getSupplyOverview, getSupplyQueue, listSupplyStaff } from '../controllers/supplyOrg.controller';

const router = Router();

// Supply-side organisation admin workspace (clinic / pharmacy). Demand orgs are
// blocked here; supply orgs are blocked from demand-only routes elsewhere.
const supplyOnly = [authenticate, asyncHandler(requireOrgClass('supply'))];

router.get('/overview', supplyOnly, asyncHandler(getSupplyOverview));
router.get('/queue', supplyOnly, asyncHandler(getSupplyQueue));
router.get('/staff', supplyOnly, asyncHandler(listSupplyStaff));

export default router;
