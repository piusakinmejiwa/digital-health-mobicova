import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'crypto';
import { env } from '../config/env';

// --- Member session token -----------------------------------------------
// A member session is distinct from a partner (staff) session: it carries a
// `scope: 'member'` claim and a memberId, never a userId/role. The partner
// authenticate() middleware rejects scope:'member' tokens and this scope is the
// only thing authenticateMember() accepts, so the two auth domains can't cross.
export interface MemberJwtPayload {
  memberId: string;
  orgId: string;
  scope: 'member';
}

export function signMemberToken(memberId: string, orgId: string): string {
  const payload: MemberJwtPayload = { memberId, orgId, scope: 'member' };
  // Members sign in from their own phone; a longer session is friendlier.
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '30d' });
}

export function verifyMemberToken(token: string): MemberJwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as MemberJwtPayload;
    if (decoded.scope !== 'member' || !decoded.memberId) return null;
    return decoded;
  } catch {
    return null;
  }
}

// --- One-time codes ------------------------------------------------------
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtpCode(): string {
  // 6 digits, zero-padded. randomInt is cryptographically sound.
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export function verifyOtpHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code.replace(/\s+/g, ''), hash);
}

// Mask a destination for display: keep the tail so the member recognises it
// without the full value leaking (e.g. "•••• 4172", "j•••@gmail.com").
export function maskDestination(value: string, kind: 'phone' | 'email'): string {
  const v = (value || '').trim();
  if (!v) return '';
  if (kind === 'email') {
    const [name, domain] = v.split('@');
    if (!domain) return v;
    const head = name.slice(0, 1);
    return `${head}${'•'.repeat(Math.max(name.length - 1, 1))}@${domain}`;
  }
  const tail = v.slice(-4);
  return `•••• ${tail}`;
}
