import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { requirePlatformAdmin } from '../middleware/platformAdmin';
import {
  adminListPartners, adminCreatePartner, adminUpdatePartner, adminDeletePartner,
  adminListPlans, adminCreatePlan, adminUpdatePlan, adminDeletePlan,
} from '../controllers/admin.controller';
import {
  adminListOrgs, adminCreateOrg, adminUpdateOrg, adminDeleteOrg,
} from '../controllers/adminOrgs.controller';
import {
  adminListUsers, adminCreateUser, adminUpdateUser,
  adminResetUserPassword, adminDeleteUser,
} from '../controllers/adminUsers.controller';
import { adminListAudit } from '../controllers/adminAudit.controller';
import { adminGetOrgSso, adminUpdateOrgSso } from '../controllers/sso.controller';

const router = Router();

// Every admin route requires a valid token AND platform-admin privileges.
router.use(authenticate);
router.use(asyncHandler(requirePlatformAdmin));

// Partner organisations (tenants)
router.get('/organisations', asyncHandler(adminListOrgs));
router.post('/organisations', asyncHandler(adminCreateOrg));
router.patch('/organisations/:id', asyncHandler(adminUpdateOrg));
router.delete('/organisations/:id', asyncHandler(adminDeleteOrg));
// Per-tenant SAML SSO config (platform-admin on behalf of a partner)
router.get('/organisations/:id/sso', asyncHandler(adminGetOrgSso));
router.put('/organisations/:id/sso', asyncHandler(adminUpdateOrgSso));

// Dashboard users
router.get('/users', asyncHandler(adminListUsers));
router.post('/users', asyncHandler(adminCreateUser));
router.patch('/users/:id', asyncHandler(adminUpdateUser));
router.post('/users/:id/reset-password', asyncHandler(adminResetUserPassword));
router.delete('/users/:id', asyncHandler(adminDeleteUser));

// Partner ecosystem
router.get('/partners', asyncHandler(adminListPartners));
router.post('/partners', asyncHandler(adminCreatePartner));
router.patch('/partners/:id', asyncHandler(adminUpdatePartner));
router.delete('/partners/:id', asyncHandler(adminDeletePartner));

// Insurance plans
router.get('/plans', asyncHandler(adminListPlans));
router.post('/plans', asyncHandler(adminCreatePlan));
router.patch('/plans/:id', asyncHandler(adminUpdatePlan));
router.delete('/plans/:id', asyncHandler(adminDeletePlan));

// Audit trail (read-only)
router.get('/audit', asyncHandler(adminListAudit));

export default router;
