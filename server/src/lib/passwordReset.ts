import crypto from 'crypto';
import { query } from '../config/database';
import { hashToken } from './invites';

// Forgotten-password reset tokens for staff users and providers. Only the SHA-256
// hash is stored (reset_token_hash); the raw token rides only in the emailed link
// and expires after 1 hour. Reuses the activation hashing (lib/invites).

const RESET_TTL = "interval '1 hour'";

export async function issueUserResetToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(24).toString('base64url');
  await query(
    `UPDATE users SET reset_token_hash = $2, reset_expires = NOW() + ${RESET_TTL} WHERE id = $1`,
    [userId, hashToken(raw)]
  );
  return raw;
}

export async function issueProviderResetToken(providerId: string): Promise<string> {
  const raw = crypto.randomBytes(24).toString('base64url');
  await query(
    `UPDATE providers SET reset_token_hash = $2, reset_expires = NOW() + ${RESET_TTL} WHERE id = $1`,
    [providerId, hashToken(raw)]
  );
  return raw;
}
