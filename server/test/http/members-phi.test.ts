import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/database', () => ({
  query: vi.fn(),
  pool: { query: vi.fn(async () => ({ rows: [] })), connect: vi.fn(), end: vi.fn(), on: vi.fn() },
}));

import request from 'supertest';
import { query } from '../../src/config/database';
import app from '../../src/app';
import { buildQueryImpl, staffToken, memberWithPhi } from './helpers';

const PHI_FIELDS = ['date_of_birth', 'phone', 'chronic_conditions', 'allergies', 'current_medications', 'blood_group'];

function getMemberAs(fx: Parameters<typeof buildQueryImpl>[0]) {
  vi.mocked(query).mockImplementation(buildQueryImpl({ member: memberWithPhi(), ...fx }) as never);
  return request(app).get('/api/v1/members/mem-1').set('Authorization', `Bearer ${staffToken()}`);
}

// The privacy guarantee, proven through the real HTTP stack (auth → controller →
// org-type lookup → isPlatformAdmin → redaction), not just the unit under it.
describe('GET /api/v1/members/:id — role-based PHI gating', () => {
  it('strips PHI for an EMPLOYER org and flags phiRestricted', async () => {
    const r = await getMemberAs({ orgType: 'company', platformAdmin: false });
    expect(r.status).toBe(200);
    expect(r.body.phiRestricted).toBe(true);
    expect(r.body.full_name).toBe('Ada Obi');
    for (const f of PHI_FIELDS) expect(r.body[f]).toBeUndefined();
  });

  it('includes PHI for an underwriter org', async () => {
    const r = await getMemberAs({ orgType: 'underwriter', platformAdmin: false });
    expect(r.status).toBe(200);
    expect(r.body.phiRestricted).toBe(false);
    expect(r.body.chronic_conditions).toEqual(['asthma']);
    expect(r.body.date_of_birth).toBe('1990-01-01');
  });

  it('includes PHI for an HMO org (new PHI owner)', async () => {
    const r = await getMemberAs({ orgType: 'hmo', platformAdmin: false });
    expect(r.status).toBe(200);
    expect(r.body.phiRestricted).toBe(false);
    expect(r.body.chronic_conditions).toEqual(['asthma']);
  });

  it('lets a platform admin see PHI even inside an employer org', async () => {
    const r = await getMemberAs({ orgType: 'company', platformAdmin: true });
    expect(r.status).toBe(200);
    expect(r.body.phiRestricted).toBe(false);
    expect(r.body.chronic_conditions).toEqual(['asthma']);
  });

  it('404s when the member is not in the caller’s org', async () => {
    vi.mocked(query).mockImplementation(buildQueryImpl({ member: null, orgType: 'company' }) as never);
    const r = await request(app).get('/api/v1/members/nope').set('Authorization', `Bearer ${staffToken()}`);
    expect(r.status).toBe(404);
  });
});
