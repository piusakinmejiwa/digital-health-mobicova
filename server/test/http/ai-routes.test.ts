import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/database', () => ({
  query: vi.fn(),
  pool: { query: vi.fn(async () => ({ rows: [] })), connect: vi.fn(), end: vi.fn(), on: vi.fn() },
}));

import request from 'supertest';
import { query } from '../../src/config/database';
import app from '../../src/app';
import { buildQueryImpl, staffToken, memberWithPhi } from './helpers';

// AI is OFF in the test env (no ANTHROPIC_API_KEY), so the routes must gate and
// degrade — never 500, never silently "succeed".
describe('AI endpoints — gating + graceful 503', () => {
  function careSummary(fx: Parameters<typeof buildQueryImpl>[0]) {
    vi.mocked(query).mockImplementation(buildQueryImpl(fx) as never);
    return request(app)
      .post('/api/v1/members/mem-1/care-summary')
      .set('Authorization', `Bearer ${staffToken()}`);
  }

  it('care summary: 403 for an employer org (clinical PHI not permitted)', async () => {
    const r = await careSummary({ member: memberWithPhi(), orgType: 'company', platformAdmin: false });
    expect(r.status).toBe(403);
  });

  it('care summary: 503 for a permitted org when AI is off', async () => {
    const r = await careSummary({ member: memberWithPhi(), orgType: 'underwriter' });
    expect(r.status).toBe(503);
  });

  it('care summary: 404 when the member is not found', async () => {
    const r = await careSummary({ member: null, orgType: 'underwriter' });
    expect(r.status).toBe(404);
  });

  function aiReview(fx: Parameters<typeof buildQueryImpl>[0]) {
    vi.mocked(query).mockImplementation(buildQueryImpl(fx) as never);
    return request(app)
      .post('/api/v1/claims/claim-1/ai-review')
      .set('Authorization', `Bearer ${staffToken()}`);
  }

  it('claim AI review: 503 when AI is off', async () => {
    const r = await aiReview({ claim: { id: 'claim-1' } });
    expect(r.status).toBe(503);
  });

  it('claim AI review: 404 when the claim is not found', async () => {
    const r = await aiReview({ claim: null });
    expect(r.status).toBe(404);
  });
});
