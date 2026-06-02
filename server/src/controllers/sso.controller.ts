import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { env } from '../config/env';
import { JwtPayload } from '../middleware/auth';
import { recordAudit } from '../lib/audit';
import {
  loadOrgSsoBySlug, loadOrgSsoById, buildSaml, ssoIsUsable, extractEmail,
  normaliseCert, upsertOrgSso, ssoConfigDto, spMetadataXml,
} from '../lib/saml';

// Bounce the browser back to the login screen with a machine-readable reason so
// the SPA can show a friendly message. Used for every SSO failure path — we
// never surface raw SAML errors to the end user.
function failToLogin(res: Response, reason: string): void {
  res.redirect(`${env.clientUrl}/login?sso_error=${encodeURIComponent(reason)}`);
}

// ---------------------------------------------------------------------------
// Public SAML flow (no JWT). Mounted under /auth/saml/:slug and /auth/sso.
// ---------------------------------------------------------------------------

// SP metadata — partners feed this to their IdP to register the platform.
// Available regardless of config state (they need our entityID/ACS to set us up).
export async function ssoMetadata(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug);
  const org = await loadOrgSsoBySlug(slug);
  if (!org) {
    res.status(404).json({ error: 'Unknown organisation' });
    return;
  }
  res.type('application/xml').send(spMetadataXml(slug));
}

// Lightweight check the login page uses to decide whether to offer the SSO
// button for a typed workspace, without leaking config details.
export async function ssoStatus(req: Request, res: Response): Promise<void> {
  const slug = String(req.query.slug || '').trim().toLowerCase();
  if (!slug) {
    res.json({ enabled: false });
    return;
  }
  const org = await loadOrgSsoBySlug(slug);
  if (!org || !org.is_active || !ssoIsUsable(org.sso)) {
    res.json({ enabled: false });
    return;
  }
  res.json({ enabled: true, slug: org.slug, orgName: org.name });
}

// SP-initiated login: build the AuthnRequest and redirect to the IdP.
export async function ssoLogin(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug);
  const org = await loadOrgSsoBySlug(slug);
  if (!org) {
    failToLogin(res, 'unknown_org');
    return;
  }
  if (!org.is_active) {
    failToLogin(res, 'org_suspended');
    return;
  }
  if (!ssoIsUsable(org.sso)) {
    failToLogin(res, 'not_configured');
    return;
  }
  try {
    const saml = buildSaml(slug, org.sso);
    const url = await saml.getAuthorizeUrlAsync('', undefined, {});
    res.redirect(url);
  } catch (err) {
    console.error(`SSO login build failed for ${slug}:`, err);
    failToLogin(res, 'idp_error');
  }
}

// Assertion Consumer Service: validate the IdP's POSTed response, match the
// email to a PRE-EXISTING user in this org (no JIT), mint our JWT, and hand the
// browser to the SPA's SSO callback with the token in the URL fragment.
export async function ssoCallback(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug);
  const org = await loadOrgSsoBySlug(slug);
  if (!org || !org.is_active || !ssoIsUsable(org.sso)) {
    failToLogin(res, 'not_configured');
    return;
  }

  let email: string | null = null;
  try {
    const saml = buildSaml(slug, org.sso);
    const { profile } = await saml.validatePostResponseAsync(req.body);
    email = extractEmail(profile as Record<string, unknown> | null, org.sso.email_attribute);
  } catch (err) {
    console.error(`SSO assertion validation failed for ${slug}:`, err);
    failToLogin(res, 'invalid_response');
    return;
  }

  if (!email) {
    failToLogin(res, 'no_email');
    return;
  }

  // Pre-existing users only: the email must already belong to an active user in
  // this exact org. We never create accounts from an assertion.
  const result = await query(
    `SELECT id, org_id, role FROM users
      WHERE org_id = $1 AND lower(email) = $2 AND is_active = true`,
    [org.id, email]
  );
  if (result.rows.length === 0) {
    await recordAudit(req, {
      action: 'auth.sso_denied',
      targetType: 'organisation',
      targetId: org.id,
      targetLabel: org.name,
      orgId: org.id,
      metadata: { email, reason: 'no_matching_user' },
    });
    failToLogin(res, 'no_account');
    return;
  }

  const user = result.rows[0];
  const payload: JwtPayload = { userId: user.id, orgId: user.org_id, role: user.role };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });

  await recordAudit(req, {
    action: 'auth.sso_login',
    targetType: 'user',
    targetId: user.id,
    targetLabel: email,
    orgId: org.id,
    metadata: { method: 'saml' },
  });

  // Token rides in the fragment (#) so it never hits the server logs / Referer.
  res.redirect(`${env.clientUrl}/sso/callback#token=${encodeURIComponent(token)}`);
}

// ---------------------------------------------------------------------------
// Org-admin self-service config (authenticated; org admin only — see routes).
// ---------------------------------------------------------------------------

export async function getMySso(req: Request, res: Response): Promise<void> {
  const org = await loadOrgSsoById(req.user!.orgId);
  if (!org) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }
  res.json(ssoConfigDto(org.slug, org.sso));
}

export async function updateMySso(req: Request, res: Response): Promise<void> {
  const org = await loadOrgSsoById(req.user!.orgId);
  if (!org) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }
  const fields = readSsoBody(req);
  const issue = validateSsoFields(fields);
  if (issue) {
    res.status(400).json({ error: issue });
    return;
  }
  const saved = await upsertOrgSso(org.id, fields);
  await recordAudit(req, {
    action: 'org.sso_update',
    targetType: 'organisation',
    targetId: org.id,
    targetLabel: org.name,
    orgId: org.id,
    metadata: { enabled: saved.enabled },
  });
  res.json(ssoConfigDto(org.slug, saved));
}

// ---------------------------------------------------------------------------
// Platform-admin config (behind authenticate + requirePlatformAdmin in routes).
// ---------------------------------------------------------------------------

export async function adminGetOrgSso(req: Request, res: Response): Promise<void> {
  const org = await loadOrgSsoById(String(req.params.id));
  if (!org) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }
  res.json(ssoConfigDto(org.slug, org.sso));
}

export async function adminUpdateOrgSso(req: Request, res: Response): Promise<void> {
  const org = await loadOrgSsoById(String(req.params.id));
  if (!org) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }
  const fields = readSsoBody(req);
  const issue = validateSsoFields(fields);
  if (issue) {
    res.status(400).json({ error: issue });
    return;
  }
  const saved = await upsertOrgSso(org.id, fields);
  await recordAudit(req, {
    action: 'org.sso_update',
    targetType: 'organisation',
    targetId: org.id,
    targetLabel: org.name,
    orgId: org.id,
    metadata: { enabled: saved.enabled, via: 'platform_admin' },
  });
  res.json(ssoConfigDto(org.slug, saved));
}

// --- shared helpers ---

interface SsoFields {
  enabled: boolean;
  entryPoint: string;
  idpIssuer: string;
  idpCert: string;
  emailAttribute: string;
}

function readSsoBody(req: Request): SsoFields {
  const b = req.body || {};
  return {
    enabled: b.enabled === true || b.enabled === 'true',
    entryPoint: String(b.entryPoint || '').trim(),
    idpIssuer: String(b.idpIssuer || '').trim(),
    idpCert: normaliseCert(String(b.idpCert || '')),
    emailAttribute: String(b.emailAttribute || '').trim(),
  };
}

// Only enforce completeness when SSO is being switched on, so admins can save a
// partial draft while collecting details from their IdP team.
function validateSsoFields(f: SsoFields): string | null {
  if (!f.enabled) return null;
  if (!/^https?:\/\//i.test(f.entryPoint)) {
    return 'A valid IdP sign-in URL (entry point) is required to enable SSO.';
  }
  if (!f.idpCert || f.idpCert.length < 100) {
    return 'A valid IdP signing certificate is required to enable SSO.';
  }
  return null;
}
