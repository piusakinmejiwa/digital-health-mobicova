import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/database', () => ({
  query: vi.fn(),
  pool: { query: vi.fn(async () => ({ rows: [] })), connect: vi.fn(), end: vi.fn(), on: vi.fn() },
}));

import request from 'supertest';
import { query } from '../../src/config/database';
import app from '../../src/app';
import { buildQueryImpl, staffToken } from './helpers';

// The HMO onboarding console is gated to hmo/insurer org types (requireOrgType),
// proven through the real HTTP stack.
describe('GET /api/v1/hierarchy/employers — org-type gate', () => {
  it('403s for a plain company', async () => {
    vi.mocked(query).mockImplementation(buildQueryImpl({ orgType: 'company' }) as never);
    const r = await request(app).get('/api/v1/hierarchy/employers').set('Authorization', `Bearer ${staffToken()}`);
    expect(r.status).toBe(403);
  });

  it('returns the employer list for an HMO', async () => {
    vi.mocked(query).mockImplementation(
      buildQueryImpl({ orgType: 'hmo', children: [{ id: 'c1', name: 'Acme Ltd', member_count: 3 }] }) as never,
    );
    const r = await request(app).get('/api/v1/hierarchy/employers').set('Authorization', `Bearer ${staffToken()}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0].name).toBe('Acme Ltd');
  });
});

describe('GET /api/v1/hierarchy/plans — assignable plans', () => {
  it('403s for a company', async () => {
    vi.mocked(query).mockImplementation(buildQueryImpl({ orgType: 'company' }) as never);
    const r = await request(app).get('/api/v1/hierarchy/plans').set('Authorization', `Bearer ${staffToken()}`);
    expect(r.status).toBe(403);
  });

  it('returns the plans an HMO offers/underwrites', async () => {
    vi.mocked(query).mockImplementation(
      buildQueryImpl({ orgType: 'hmo', assignablePlans: [{ id: 'p1', name: 'Bronze', kind: 'group' }] }) as never,
    );
    const r = await request(app).get('/api/v1/hierarchy/plans').set('Authorization', `Bearer ${staffToken()}`);
    expect(r.status).toBe(200);
    expect(r.body[0].name).toBe('Bronze');
  });
});
