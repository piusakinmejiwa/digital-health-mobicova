import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { env } from '../config/env';
import { JwtPayload } from '../middleware/auth';
import { isPlatformAdmin } from '../middleware/platformAdmin';
import { generateJoinCode } from '../lib/org';
import { orgClass } from '../lib/orgTypes';
import { hashToken } from '../lib/invites';
import { passwordIssue } from '../lib/password';
import {
  generateTotpSecret,
  buildOtpauthUrl,
  verifyTotp,
  generateBackupCodes,
  hashBackupCodes,
  consumeBackupCode,
  signMfaPendingToken,
  verifyMfaPendingToken,
} from '../lib/mfa';
import { recordAudit, writeAudit } from '../lib/audit';
import QRCode from 'qrcode';

// Shape of the session a successful auth hands back to the client.
interface SessionUserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  org_id: string;
  org_name: string;
  partner_type: string;
}

function issueSession(user: SessionUserRow) {
  const payload: JwtPayload = { userId: user.id, orgId: user.org_id, role: user.role as JwtPayload['role'] };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      orgId: user.org_id,
      orgName: user.org_name,
      partnerType: user.partner_type,
      orgClass: orgClass(user.partner_type),
    },
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, fullName, orgName, partnerType } = req.body;

  const pwIssue = passwordIssue(password);
  if (pwIssue) {
    res.status(400).json({ error: pwIssue });
    return;
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const slugExists = await query('SELECT id FROM organisations WHERE slug = $1', [slug]);
  if (slugExists.rows.length > 0) {
    res.status(409).json({ error: 'Organisation name already taken' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const joinCode = await generateJoinCode();
  const orgResult = await query(
    `INSERT INTO organisations (name, slug, type, join_code) VALUES ($1, $2, $3, $4) RETURNING id`,
    [orgName, slug, partnerType || 'employer', joinCode]
  );
  const orgId = orgResult.rows[0].id;

  const userResult = await query(
    `INSERT INTO users (org_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, 'admin') RETURNING id`,
    [orgId, email, passwordHash, fullName]
  );

  const payload: JwtPayload = { userId: userResult.rows[0].id, orgId, role: 'admin' };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });

  res.status(201).json({
    token,
    user: { id: userResult.rows[0].id, email, fullName, role: 'admin', orgId, orgName, partnerType: partnerType || 'employer' },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  const result = await query(
    `SELECT u.id, u.org_id, u.email, u.password_hash, u.full_name, u.role, u.totp_enabled,
            o.name as org_name, o.type AS partner_type, o.is_active AS org_active
     FROM users u JOIN organisations o ON u.org_id = o.id
     WHERE u.email = $1 AND u.is_active = true`,
    [email]
  );

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // A suspended organisation blocks all of its users from signing in.
  if (result.rows[0].org_active === false) {
    res.status(403).json({ error: 'This organisation is suspended. Contact MobiCova support.' });
    return;
  }

  const user = result.rows[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // MFA gate: password was correct, but a second factor is required. Hand back a
  // short-lived token that only authorises the /auth/mfa/challenge step.
  if (user.totp_enabled) {
    res.json({ mfaRequired: true, mfaToken: signMfaPendingToken(user.id) });
    return;
  }

  await writeAudit({ actorId: user.id, actorEmail: user.email, action: 'auth.login', orgId: user.org_id, ip: req.ip, metadata: { method: 'password' } });
  res.json(issueSession(user));
}

// Second step of MFA login: exchange the pending token + a TOTP (or backup) code
// for a full session. Backup codes are single-use and consumed on success.
export async function mfaChallenge(req: Request, res: Response): Promise<void> {
  const { mfaToken, code } = req.body;

  const userId = verifyMfaPendingToken(mfaToken);
  if (!userId) {
    res.status(401).json({ error: 'Your verification session expired. Please sign in again.' });
    return;
  }

  const result = await query(
    `SELECT u.id, u.org_id, u.email, u.full_name, u.role, u.totp_secret, u.totp_backup_codes,
            o.name as org_name, o.type AS partner_type, o.is_active AS org_active
     FROM users u JOIN organisations o ON u.org_id = o.id
     WHERE u.id = $1 AND u.is_active = true`,
    [userId]
  );
  if (result.rows.length === 0 || result.rows[0].org_active === false) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const user = result.rows[0];
  const cleaned = String(code || '').replace(/\s+/g, '');

  // A 6-digit string is a TOTP; anything else we treat as a backup code.
  let verified = false;
  if (/^\d{6}$/.test(cleaned)) {
    verified = verifyTotp(user.totp_secret, cleaned);
  }
  if (!verified) {
    const remaining = await consumeBackupCode(cleaned, user.totp_backup_codes || []);
    if (remaining) {
      await query('UPDATE users SET totp_backup_codes = $1 WHERE id = $2', [remaining, user.id]);
      verified = true;
    }
  }

  if (!verified) {
    res.status(401).json({ error: 'That code is not valid. Try again or use a backup code.' });
    return;
  }

  await writeAudit({ actorId: user.id, actorEmail: user.email, action: 'auth.login', orgId: user.org_id, ip: req.ip, metadata: { method: 'mfa' } });
  res.json(issueSession(user));
}

// Start MFA setup: generate a secret, store it (not yet enabled), and return the
// QR / otpauth URL for the user's authenticator app.
export async function mfaSetup(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const result = await query('SELECT email, totp_enabled FROM users WHERE id = $1', [req.user.userId]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (result.rows[0].totp_enabled) {
    res.status(409).json({ error: 'Two-factor authentication is already enabled.' });
    return;
  }

  const secret = generateTotpSecret();
  await query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, req.user.userId]);

  const otpauthUrl = buildOtpauthUrl(result.rows[0].email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  res.json({ secret, otpauthUrl, qrDataUrl });
}

// Confirm setup: verify the first code, flip the flag on, and return the
// one-time backup codes (shown once, never recoverable afterwards).
export async function mfaEnable(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const { code } = req.body;

  const result = await query(
    'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
    [req.user.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (result.rows[0].totp_enabled) {
    res.status(409).json({ error: 'Two-factor authentication is already enabled.' });
    return;
  }
  if (!result.rows[0].totp_secret) {
    res.status(400).json({ error: 'Start setup first.' });
    return;
  }
  if (!verifyTotp(result.rows[0].totp_secret, String(code || ''))) {
    res.status(400).json({ error: 'That code is not valid. Check your authenticator app and try again.' });
    return;
  }

  const backupCodes = generateBackupCodes();
  const hashed = await hashBackupCodes(backupCodes);
  await query(
    'UPDATE users SET totp_enabled = true, totp_backup_codes = $1 WHERE id = $2',
    [hashed, req.user.userId]
  );

  await recordAudit(req, {
    action: 'auth.mfa_enabled',
    targetType: 'user',
    targetId: req.user.userId,
    orgId: req.user.orgId,
  });

  res.json({ enabled: true, backupCodes });
}

// Turn MFA off. Requires the current password as a re-auth step.
export async function mfaDisable(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const { password } = req.body;

  const result = await query(
    'SELECT password_hash, totp_enabled FROM users WHERE id = $1',
    [req.user.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (!result.rows[0].totp_enabled) {
    res.json({ enabled: false });
    return;
  }
  const ok = await bcrypt.compare(String(password || ''), result.rows[0].password_hash);
  if (!ok) {
    res.status(401).json({ error: 'Incorrect password.' });
    return;
  }

  await query(
    `UPDATE users SET totp_enabled = false, totp_secret = '', totp_backup_codes = '{}' WHERE id = $1`,
    [req.user.userId]
  );

  await recordAudit(req, {
    action: 'auth.mfa_disabled',
    targetType: 'user',
    targetId: req.user.userId,
    orgId: req.user.orgId,
  });

  res.json({ enabled: false });
}

// Lightweight status for the Security settings page.
export async function mfaStatus(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const result = await query(
    `SELECT totp_enabled, array_length(totp_backup_codes, 1) AS backup_count
     FROM users WHERE id = $1`,
    [req.user.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    enabled: result.rows[0].totp_enabled,
    backupCodesRemaining: result.rows[0].backup_count || 0,
  });
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.org_id, u.totp_enabled,
            o.name as org_name, o.type AS partner_type, o.plan_tier, o.join_code
     FROM users u JOIN organisations o ON u.org_id = o.id
     WHERE u.id = $1`,
    [req.user.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const user = result.rows[0];
  res.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    orgId: user.org_id,
    orgName: user.org_name,
    partnerType: user.partner_type,
    orgClass: orgClass(user.partner_type),
    planTier: user.plan_tier,
    joinCode: user.join_code,
    mfaEnabled: user.totp_enabled,
    isPlatformAdmin: await isPlatformAdmin(req.user.userId),
  });
}

// POST /auth/activate { token, password } — an invited admin sets their password
// via the link in their welcome email. Public; the token is the credential.
export async function activateAccount(req: Request, res: Response): Promise<void> {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (!token) {
    res.status(400).json({ error: 'Invalid activation link.' });
    return;
  }
  const issue = passwordIssue(password);
  if (issue) {
    res.status(400).json({ error: issue });
    return;
  }
  const result = await query(
    `SELECT id, email FROM users
      WHERE activation_token_hash = $1 AND activation_expires > NOW()`,
    [hashToken(token)]
  );
  if (result.rows.length === 0) {
    res.status(400).json({ error: 'This activation link is invalid or has expired. Ask your administrator to resend it.' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await query(
    `UPDATE users
        SET password_hash = $2, activation_token_hash = NULL, activation_expires = NULL, updated_at = NOW()
      WHERE id = $1`,
    [result.rows[0].id, passwordHash]
  );
  res.json({ ok: true, email: result.rows[0].email });
}
