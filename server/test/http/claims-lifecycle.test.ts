import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/database', () => ({
  query: vi.fn(),
  pool: { query: vi.fn(async () => ({ rows: [] })), connect: vi.fn(), end: vi.fn(), on: vi.fn() },
}));

import request from 'supertest';
import { query } from '../../src/config/database';
import app from '../../src/app';
import { buildQueryImpl, staffToken } from './helpers';

function decide(body: object, fx: Parameters<typeof buildQueryImpl>[0] = {}, role = 'admin') {
  vi.mocked(query).mockImplementation(buildQueryImpl(fx) as never);
  return request(app)
    .patch('/api/v1/claims/claim-1/decision')
    .set('Authorization', `Bearer ${staffToken({ role })}`)
    .send(body);
}

// The adjudication state machine, enforced at the endpoint — illegal jumps must
// be refused, not quietly written.
describe('PATCH /api/v1/claims/:id/decision', () => {
  it('rejects an unknown status (400)', async () => {
    const r = await decide({ status: 'banana' }, { claim: { status: 'submitted', reference: 'CLM-1' } });
    expect(r.status).toBe(400);
  });

  it('404s when the claim is not in the org', async () => {
    const r = await decide({ status: 'approved' }, { claim: null });
    expect(r.status).toBe(404);
  });

  it('blocks an illegal transition with 409', async () => {
    // paid is terminal — it can't move to approved.
    const r = await decide({ status: 'approved' }, { claim: { status: 'paid', reference: 'CLM-1' } });
    expect(r.status).toBe(409);
  });

  it('allows a legal transition (200)', async () => {
    const r = await decide(
      { status: 'approved' },
      { claim: { status: 'submitted', reference: 'CLM-1' }, updatedClaim: { id: 'claim-1', status: 'approved', reference: 'CLM-1' } },
    );
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('approved');
  });

  it('forbids a read-only analyst from deciding (403)', async () => {
    const r = await decide({ status: 'approved' }, { claim: { status: 'submitted', reference: 'CLM-1' } }, 'analyst');
    expect(r.status).toBe(403);
  });
});
