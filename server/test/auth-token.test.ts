import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signMemberToken, verifyMemberToken } from '../src/lib/memberAuth';
import { env } from '../src/config/env';

// Member session tokens, and the cross-domain boundary: a member token must
// round-trip, and anything without scope:'member' must be rejected (so a staff
// token can never be replayed as a member, or a tampered token accepted).
describe('member session tokens', () => {
  it('round-trips a valid member token', () => {
    const token = signMemberToken('member-123', 'org-abc');
    const payload = verifyMemberToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.memberId).toBe('member-123');
    expect(payload?.orgId).toBe('org-abc');
    expect(payload?.scope).toBe('member');
  });

  it('rejects garbage and tampered tokens', () => {
    expect(verifyMemberToken('not.a.jwt')).toBeNull();
    const token = signMemberToken('member-123', 'org-abc');
    expect(verifyMemberToken(token + 'x')).toBeNull();
  });

  it('rejects a validly-signed token that lacks scope:member', () => {
    // A staff-shaped token signed with the same secret must NOT pass as a member.
    const staffish = jwt.sign({ userId: 'u1', orgId: 'org-abc', role: 'admin' }, env.jwtSecret);
    expect(verifyMemberToken(staffish)).toBeNull();
  });

  it('rejects a token signed with the wrong secret', () => {
    const forged = jwt.sign({ memberId: 'm1', orgId: 'o1', scope: 'member' }, 'a-different-secret');
    expect(verifyMemberToken(forged)).toBeNull();
  });
});
