import { createHash, timingSafeEqual } from 'crypto';

// Constant-time string comparison for secrets/tokens/signatures. Both inputs are
// SHA-256 hashed to a fixed 32-byte length first, so timingSafeEqual never throws
// on a length mismatch and the compare leaks neither the value nor its length.
// Use this instead of `===`/`!==` anywhere an attacker-supplied value is checked
// against a server secret (webhook tokens, cron secrets, HMAC signatures).
export function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
