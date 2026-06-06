import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireWrite } from '../middleware/auth';
import { requireOrgClass } from '../middleware/orgCapability';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getSupplyOverview, getSupplyQueue, listSupplyStaff, addSupplyStaff, setSupplyStaffActive,
} from '../controllers/supplyOrg.controller';

const router = Router();

// Supply-side organisation admin workspace (clinic / pharmacy). Demand orgs are
// blocked here; supply orgs are blocked from demand-only routes elsewhere.
const supplyOnly = [authenticate, asyncHandler(requireOrgClass('supply'))];

router.get('/overview', supplyOnly, asyncHandler(getSupplyOverview));
router.get('/queue', supplyOnly, asyncHandler(getSupplyQueue));
router.get('/staff', supplyOnly, asyncHandler(listSupplyStaff));
router.post(
  '/staff', supplyOnly, requireWrite,
  [body('fullName').trim().notEmpty(), body('email').isEmail().normalizeEmail()],
  validate, asyncHandler(addSupplyStaff)
);
router.patch('/staff/:id', supplyOnly, requireWrite, asyncHandler(setSupplyStaffActive));

export default router;
