import { Router } from 'express';
import { authenticate, requireWrite } from '../middleware/auth';
import { requireOrgType } from '../middleware/orgCapability';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listChildEmployers, createChildEmployer,
  listAssignablePlans, listEmployerAssignments, assignPlan, unassignPlan,
} from '../controllers/hierarchy.controller';

// HMO / insurer onboarding console — manage the employer orgs beneath this org.
// Restricted to the aggregator tiers (hmo, underwriter).
const router = Router();

router.use(authenticate);
router.use(asyncHandler(requireOrgType('hmo', 'underwriter')));

router.get('/employers', asyncHandler(listChildEmployers));
router.post('/employers', requireWrite, asyncHandler(createChildEmployer));

// Plans this org can assign, and per-employer plan assignments.
router.get('/plans', asyncHandler(listAssignablePlans));
router.get('/employers/:id/plans', asyncHandler(listEmployerAssignments));
router.post('/employers/:id/plans', requireWrite, asyncHandler(assignPlan));
router.delete('/employers/:id/plans/:assignmentId', requireWrite, asyncHandler(unassignPlan));

export default router;
