import { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  getMe,
  activateAccount,
  mfaChallenge,
  mfaSetup,
  mfaEnable,
  mfaDisable,
  mfaStatus,
} from '../controllers/auth.controller';
import { ssoMetadata, ssoStatus, ssoLogin, ssoCallback } from '../controllers/sso.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('fullName').trim().notEmpty(),
    body('orgName').trim().notEmpty(),
  ],
  validate,
  asyncHandler(register)
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  asyncHandler(login)
);

router.get('/me', authenticate, asyncHandler(getMe));

// Account activation — an invited admin sets their password (public; token-gated).
router.post(
  '/activate',
  [body('token').notEmpty(), body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  validate,
  asyncHandler(activateAccount)
);

// --- Multi-factor authentication (TOTP) ---
// Second login step: exchange the pending token + a code for a session (public,
// the pending token is the credential).
router.post(
  '/mfa/challenge',
  [body('mfaToken').notEmpty(), body('code').trim().notEmpty()],
  validate,
  asyncHandler(mfaChallenge)
);
// Authenticated self-service setup/management.
router.get('/mfa/status', authenticate, asyncHandler(mfaStatus));
router.post('/mfa/setup', authenticate, asyncHandler(mfaSetup));
router.post(
  '/mfa/enable',
  authenticate,
  [body('code').trim().notEmpty()],
  validate,
  asyncHandler(mfaEnable)
);
router.post(
  '/mfa/disable',
  authenticate,
  [body('password').notEmpty()],
  validate,
  asyncHandler(mfaDisable)
);

// --- SAML SSO (public; per-tenant by org slug) ---
// status lets the login page decide whether to offer the SSO button.
router.get('/sso/status', asyncHandler(ssoStatus));
// SP metadata a partner registers with their IdP.
router.get('/saml/:slug/metadata', asyncHandler(ssoMetadata));
// SP-initiated login -> redirect to the IdP.
router.get('/saml/:slug/login', asyncHandler(ssoLogin));
// Assertion Consumer Service: the IdP POSTs its signed response here.
router.post('/saml/:slug/callback', asyncHandler(ssoCallback));

export default router;
