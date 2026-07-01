import jwt from 'jsonwebtoken';
import { env } from '../config/env';

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
}

export function signProviderToken(providerId: string, partnerId: string | null, role: ProviderRole): string {
  const payload: ProviderJwtPayload = { providerId, partnerId: partnerId ?? null, role, scope: 'provider' };
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
