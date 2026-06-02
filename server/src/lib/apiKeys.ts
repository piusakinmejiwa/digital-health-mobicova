import { randomBytes, createHash, timingSafeEqual } from 'crypto';

// Public-API keys. The full key is shown to the partner exactly once; we persist
// only a SHA-256 hash (keys are high-entropy, so a fast hash is appropriate —
// unlike user passwords) plus a short non-secret prefix used for display and to
// narrow the lookup before the constant-time hash comparison.
//
// Format: mk_live_<48 hex chars>. The prefix stored/displayed is the first 14
// chars (e.g. "mk_live_3f9a2b"), which is not enough to reconstruct the key.

const KEY_BODY_BYTES = 24; // 48 hex chars
const PREFIX_LEN = 14;

export interface GeneratedApiKey {
  fullKey: string;
  prefix: string;
  hash: string;
}

export function generateApiKey(): GeneratedApiKey {
  const fullKey = `mk_live_${randomBytes(KEY_BODY_BYTES).toString('hex')}`;
  return { fullKey, prefix: fullKey.slice(0, PREFIX_LEN), hash: hashApiKey(fullKey) };
}

export function hashApiKey(fullKey: string): string {
  return createHash('sha256').update(fullKey).digest('hex');
}

export function apiKeyPrefix(fullKey: string): string {
  return fullKey.slice(0, PREFIX_LEN);
}

// Constant-time compare of two hex digests of equal length.
export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
