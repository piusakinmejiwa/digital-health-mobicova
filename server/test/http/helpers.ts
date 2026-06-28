// Shared helpers for HTTP-level tests: token signing (matches the real auth
// middleware) and a SQL-routing mock for the database layer, so a request flows
// through the real Express app + middleware + controller with controlled data.
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';

// A staff token WITHOUT `sid` — authenticate() then skips the session-revocation
// DB lookup, so auth is pure-crypto and needs no mocked query.
export function staffToken(o: { userId?: string; orgId?: string; role?: string } = {}): string {
  return jwt.sign(
    { userId: o.userId ?? 'user-1', orgId: o.orgId ?? 'org-1', role: o.role ?? 'admin' },
    env.jwtSecret,
  );
}

export function memberToken(): string {
  return jwt.sign({ memberId: 'm-1', orgId: 'org-1', scope: 'member' }, env.jwtSecret);
}

export interface Fixtures {
  member?: Record<string, unknown> | null;
  memberList?: unknown[];
  orgType?: string;
  platformAdmin?: boolean;
  userEmail?: string;
  failSelect1?: boolean; // make the readiness probe's "SELECT 1" throw
  claim?: Record<string, unknown> | null;       // existing claim row (status/reference)
  updatedClaim?: Record<string, unknown> | null; // row returned by UPDATE ... RETURNING *
}

const wrap = (rows: unknown[]) => ({ rows, rowCount: rows.length });

// Routes a SQL string to canned rows. Order matters: the more specific member
// lookup (by id) is matched before the list query.
export function buildQueryImpl(fx: Fixtures) {
  return async (sql: string) => {
    const s = String(sql);
    // The readiness probe is a bare "SELECT 1" — must not catch existence checks
    // like "SELECT 1 FROM members/claims WHERE id …".
    if (/\bSELECT 1\b/.test(s) && !/\bFROM\b/i.test(s)) {
      if (fx.failSelect1) throw new Error('database unavailable');
      return wrap([{ ok: 1 }]);
    }
    if (/FROM members WHERE id/.test(s)) return wrap(fx.member ? [fx.member] : []);
    if (/FROM members m WHERE/.test(s)) return wrap(fx.memberList ?? []);
    if (/FROM organisations WHERE id/.test(s)) return wrap([{ type: fx.orgType ?? 'company' }]);
    if (/FROM users WHERE id/.test(s)) return wrap([{ email: fx.userEmail ?? 'staff@x.com', is_platform_admin: fx.platformAdmin ?? false }]);
    if (/UPDATE claims/.test(s)) return wrap(fx.updatedClaim ? [fx.updatedClaim] : []);
    if (/FROM claims WHERE id/.test(s)) return wrap(fx.claim ? [fx.claim] : []);
    // Member-profile related reads — empty is fine for these tests.
    if (/FROM consultations|FROM enrolments|FROM triage_sessions|FROM prescriptions|member_care_summaries/.test(s)) {
      return wrap([]);
    }
    return wrap([]);
  };
}

// A complete member row carrying every PHI field, for redaction tests.
export function memberWithPhi() {
  return {
    id: 'mem-1', org_id: 'org-1', full_name: 'Ada Obi', membership_id: 'MOB-1',
    status: 'active', channel: 'app', gender: 'female', email: 'ada@x.com',
    date_of_birth: '1990-01-01', phone: '+2348012345678', blood_group: 'O+',
    allergies: ['penicillin'], chronic_conditions: ['asthma'], current_medications: ['ventolin'],
  };
}
