import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { requirePlatformAdmin } from '../middleware/platformAdmin';
import {
  adminListPartners, adminCreatePartner, adminUpdatePartner, adminDeletePartner,
  adminListPlans, adminCreatePlan, adminUpdatePlan, adminDeletePlan,
} from '../controllers/admin.controller';
import {
  adminListOrgs, adminCreateOrg, adminUpdateOrg, adminDeleteOrg,
  adminGetOrgBranding, adminUpdateOrgBranding,
  adminGetOrgOnboarding, adminSaveOrgOnboarding,
  adminImpersonateOrg,
} from '../controllers/adminOrgs.controller';
import {
  adminListUsers, adminCreateUser, adminUpdateUser,
  adminResetUserPassword, adminDeleteUser,
} from '../controllers/adminUsers.controller';
import { adminListAudit } from '../controllers/adminAudit.controller';
import { adminListProspectFeedback, analyzeProspectFeedback } from '../controllers/prospectFeedback.controller';
import { adminGetOrgSso, adminUpdateOrgSso } from '../controllers/sso.controller';
import { adminAiStatus, adminBuddySafety } from '../controllers/adminDiagnostics.controller';
import { adminListPosts, adminCreatePost, adminUpdatePost, adminDeletePost, adminUploadImage } from '../controllers/blog.controller';
import { adminListContactMessages, adminDeleteContactMessage } from '../controllers/contact.controller';
import { adminListPageAssets, adminUpsertPageAsset, adminGenerateImage } from '../controllers/pageAssets.controller';
import { adminListNewsletterSignups, adminDeleteNewsletterSignup } from '../controllers/newsletter.controller';
import {
  adminListSubscribers, adminDeleteSubscriber, adminListTips, adminCreateTip,
  adminUpdateTip, adminDeleteTip, adminListTipSends, adminSendDailyTipNow,
} from '../controllers/healthTips.controller';

// In-memory upload (image goes straight to Supabase Storage; 5 MB cap, images only).
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});
// Onboarding documents (PDF/images/spreadsheets) → private Supabase bucket; 10 MB.
const docUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
import {
  adminListProviders, adminCreateProvider, adminUpdateProvider,
  adminResetProviderPassword, adminDeleteProvider,
} from '../controllers/adminProviders.controller';
import {
  adminListOrgDocuments, adminUploadOrgDocument, adminDeleteOrgDocument,
  adminGetOrgHr, adminSaveOrgHr, adminSyncOrgHr,
} from '../controllers/adminOrgData.controller';
import { adminImportOrgMembers, adminListOrgMembers, adminUpdateOrgMember } from '../controllers/members.controller';
import {
  adminBulkImportProviders, adminListPartnerDocuments, adminUploadPartnerDocument, adminDeletePartnerDocument,
} from '../controllers/adminPartnerData.controller';
import {
  adminGetOrgReports, adminSaveOrgReports, adminPreviewOrgReport, adminSendOrgReportNow,
} from '../controllers/reports.controller';
import {
  adminListChallenges, adminCreateChallenge, adminUpdateChallenge, adminDeleteChallenge,
  adminListCatalogue, adminCreateCatalogueItem, adminUpdateCatalogueItem, adminDeleteCatalogueItem,
  adminListRedemptions, adminUpdateRedemption,
} from '../controllers/adminRewards.controller';

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
// Per-tenant white-label branding (platform-admin on behalf of a partner)
router.get('/organisations/:id/branding', asyncHandler(adminGetOrgBranding));
router.put('/organisations/:id/branding', asyncHandler(adminUpdateOrgBranding));
router.get('/organisations/:id/onboarding', asyncHandler(adminGetOrgOnboarding));
router.put('/organisations/:id/onboarding', asyncHandler(adminSaveOrgOnboarding));
// Onboarding documents
router.get('/organisations/:id/documents', asyncHandler(adminListOrgDocuments));
router.post('/organisations/:id/documents', docUpload.single('file'), asyncHandler(adminUploadOrgDocument));
router.delete('/organisations/:id/documents/:docId', asyncHandler(adminDeleteOrgDocument));
// HR / payroll integration (generic scaffold)
router.get('/organisations/:id/hr', asyncHandler(adminGetOrgHr));
router.put('/organisations/:id/hr', asyncHandler(adminSaveOrgHr));
router.post('/organisations/:id/hr/sync', asyncHandler(adminSyncOrgHr));
// Member CSV import into this specific org (platform admin onboarding a tenant)
router.post('/organisations/:id/members/import', asyncHandler(adminImportOrgMembers));
// Cross-org member management (platform admin — any org, not just their own)
router.get('/organisations/:id/members', asyncHandler(adminListOrgMembers));
router.patch('/organisations/:id/members/:memberId', asyncHandler(adminUpdateOrgMember));
// "View as org" — issue a token scoped to the tenant
router.post('/organisations/:id/impersonate', asyncHandler(adminImpersonateOrg));

// Scheduled client reports — per-tenant cadence/recipients, preview & send-now
router.get('/organisations/:id/reports', asyncHandler(adminGetOrgReports));
router.put('/organisations/:id/reports', asyncHandler(adminSaveOrgReports));
router.post('/organisations/:id/reports/preview', asyncHandler(adminPreviewOrgReport));
router.post('/organisations/:id/reports/send-now', asyncHandler(adminSendOrgReportNow));

// Rewards — challenges (Phase 2)
router.get('/rewards/challenges', asyncHandler(adminListChallenges));
router.post('/rewards/challenges', asyncHandler(adminCreateChallenge));
router.patch('/rewards/challenges/:id', asyncHandler(adminUpdateChallenge));
router.delete('/rewards/challenges/:id', asyncHandler(adminDeleteChallenge));
// Rewards — redemption catalogue + queue (Phase 3)
router.get('/rewards/catalogue', asyncHandler(adminListCatalogue));
router.post('/rewards/catalogue', asyncHandler(adminCreateCatalogueItem));
router.patch('/rewards/catalogue/:id', asyncHandler(adminUpdateCatalogueItem));
router.delete('/rewards/catalogue/:id', asyncHandler(adminDeleteCatalogueItem));
router.get('/rewards/redemptions', asyncHandler(adminListRedemptions));
router.patch('/rewards/redemptions/:id', asyncHandler(adminUpdateRedemption));

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
// Doctor-network onboarding: bulk-register providers + the network's documents
router.post('/partners/:id/providers/import', asyncHandler(adminBulkImportProviders));
router.get('/partners/:id/documents', asyncHandler(adminListPartnerDocuments));
router.post('/partners/:id/documents', docUpload.single('file'), asyncHandler(adminUploadPartnerDocument));
router.delete('/partners/:id/documents/:docId', asyncHandler(adminDeletePartnerDocument));

// Providers (clinicians & pharmacists)
router.get('/providers', asyncHandler(adminListProviders));
router.post('/providers', asyncHandler(adminCreateProvider));
router.patch('/providers/:id', asyncHandler(adminUpdateProvider));
router.post('/providers/:id/reset-password', asyncHandler(adminResetProviderPassword));
router.delete('/providers/:id', asyncHandler(adminDeleteProvider));

// Insurance plans
router.get('/plans', asyncHandler(adminListPlans));
router.post('/plans', asyncHandler(adminCreatePlan));
router.patch('/plans/:id', asyncHandler(adminUpdatePlan));
router.delete('/plans/:id', asyncHandler(adminDeletePlan));

// Audit trail (read-only)
router.get('/audit', asyncHandler(adminListAudit));

// Prospect discovery / feature-priority feedback (read-only) + AI analysis
router.get('/prospect-feedback', asyncHandler(adminListProspectFeedback));
router.post('/prospect-feedback/analyze', asyncHandler(analyzeProspectFeedback));

// AI integration health — makes a tiny live call to confirm Anthropic is working
// (vs the Buddy silently running in fallback mode). Never exposes the key.
router.get('/ai-status', asyncHandler(adminAiStatus));

// Buddy safety-review queue — conversations the safety layer flagged (read-only).
router.get('/buddy-safety', asyncHandler(adminBuddySafety));

// Blog authoring (create/edit/schedule/delete posts)
router.get('/blog', asyncHandler(adminListPosts));
router.post('/blog', asyncHandler(adminCreatePost));
router.patch('/blog/:id', asyncHandler(adminUpdatePost));
router.delete('/blog/:id', asyncHandler(adminDeletePost));
router.post('/blog/upload', imageUpload.single('image'), asyncHandler(adminUploadImage));

// Contact-form submissions
router.get('/contact-messages', asyncHandler(adminListContactMessages));
router.delete('/contact-messages/:id', asyncHandler(adminDeleteContactMessage));

// Page hero images + AI image generation
router.get('/page-assets', asyncHandler(adminListPageAssets));
router.put('/page-assets/:slug', asyncHandler(adminUpsertPageAsset));
router.post('/generate-image', asyncHandler(adminGenerateImage));

// Newsletter sign-ups
router.get('/newsletter', asyncHandler(adminListNewsletterSignups));
router.delete('/newsletter/:id', asyncHandler(adminDeleteNewsletterSignup));

// Daily Health Tips — subscribers, tip library, send history + manual send
router.get('/health-tips/subscribers', asyncHandler(adminListSubscribers));
router.delete('/health-tips/subscribers/:id', asyncHandler(adminDeleteSubscriber));
router.get('/health-tips/tips', asyncHandler(adminListTips));
router.post('/health-tips/tips', asyncHandler(adminCreateTip));
router.patch('/health-tips/tips/:id', asyncHandler(adminUpdateTip));
router.delete('/health-tips/tips/:id', asyncHandler(adminDeleteTip));
router.get('/health-tips/sends', asyncHandler(adminListTipSends));
router.post('/health-tips/send-now', asyncHandler(adminSendDailyTipNow));

export default router;
