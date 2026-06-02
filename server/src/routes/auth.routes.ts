import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe } from '../controllers/auth.controller';
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
