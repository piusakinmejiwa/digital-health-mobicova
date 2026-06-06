import crypto from 'crypto';
import { query } from '../config/database';

// Account-activation (invite) tokens. We store only the SHA-256 hash of the
// token; the raw token travels only in the emailed link.

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Issue a fresh activation token for a user (7-day expiry). Returns the raw
// token to embed in the activation link.
export async function issueActivationToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(24).toString('base64url');
  await query(
    `UPDATE users
        SET activation_token_hash = $2,
            activation_expires = NOW() + interval '7 days'
      WHERE id = $1`,
    [userId, hashToken(raw)]
  );
  return raw;
}

// A random unusable password hash placeholder for invited-but-not-yet-activated
// accounts (keeps password_hash NOT NULL; the account can't log in until the
// activation link sets a real password).
export function randomPlaceholderSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}
