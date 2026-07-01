import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { query } from '../config/database';

// Provider (clinician / pharmacist) session token. A third, isolated auth domain
// alongside staff (userId) and member (scope:'member'). Carries scope:'provider'
// plus the provider, their partner, and their role — never a userId, so the
// partner authenticate() middleware (which requires userId) rejects it.
export type ProviderRole = 'doctor' | 'pharmacist';

export interface ProviderJwtPayload {
  providerId: string;
  partnerId: string | null; // legacy link; may be null for org-native providers
  role: ProviderRole;
  scope: 'provider';
  // Session epoch (providers.session_epoch) at issue; bumping the row invalidates
  // all outstanding tokens. Absent on legacy tokens → treated as epoch 0.
  ep?: number;
}

export function signProviderToken(providerId: string, partnerId: string | null, role: ProviderRole, epoch = 0): string {
  const payload: ProviderJwtPayload = { providerId, partnerId: partnerId ?? null, role, scope: 'provider', ep: epoch };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}

export function verifyProviderToken(token: string): ProviderJwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as ProviderJwtPayload;
    if (decoded.scope !== 'provider' || !decoded.providerId) return null;
    return decoded;
  } catch {
    return null;
  }
}

// Current session epoch for a provider, or null if the provider no longer exists.
export async function getProviderSessionEpoch(providerId: string): Promise<number | null> {
  const r = await query('SELECT session_epoch FROM providers WHERE id = $1', [providerId]);
  return r.rows.length ? Number(r.rows[0].session_epoch) : null;
}

// Revoke every outstanding token for a provider ("sign out everywhere").
export async function revokeProviderSessions(providerId: string): Promise<void> {
  await query('UPDATE providers SET session_epoch = session_epoch + 1 WHERE id = $1', [providerId]);
}
