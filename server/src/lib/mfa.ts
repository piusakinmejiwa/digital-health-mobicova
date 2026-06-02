import { authenticator } from 'otplib';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { env } from '../config/env';

// Allow one 30s step of clock drift in either direction.
authenticator.options = { window: 1 };

// Label shown inside the user's authenticator app.
const ISSUER = 'MobiCova';

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpauthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export function verifyTotp(secret: string, token: string): boolean {
  if (!secret || !token) return false;
  try {
    return authenticator.verify({ token: token.replace(/\s+/g, ''), secret });
  } catch {
    return false;
  }
}

// --- Backup codes -------------------------------------------------------
// Ten single-use recovery codes, shown once in plaintext at enable time and
// stored only as bcrypt hashes. Format: XXXX-XXXX (uppercase alphanumeric).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function randomCode(): string {
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (i === 3) out += '-';
  }
  return out;
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomCode());
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
}

// Returns the remaining (unused) hashes if a code matches, else null.
export async function consumeBackupCode(
  input: string,
  hashes: string[]
): Promise<string[] | null> {
  const candidate = input.replace(/\s+/g, '').toUpperCase();
  if (!candidate) return null;
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(candidate, hashes[i])) {
      return hashes.filter((_, idx) => idx !== i);
    }
  }
  return null;
}

// --- Pending (mfa-challenge) token --------------------------------------
// Short-lived token issued after a correct password when MFA is on. It only
// authorises the /auth/mfa/challenge step — not the API at large.
interface MfaPendingPayload {
  userId: string;
  scope: 'mfa';
}

export function signMfaPendingToken(userId: string): string {
  const payload: MfaPendingPayload = { userId, scope: 'mfa' };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '5m' });
}

export function verifyMfaPendingToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as MfaPendingPayload;
    if (decoded.scope !== 'mfa') return null;
    return decoded.userId;
  } catch {
    return null;
  }
}
