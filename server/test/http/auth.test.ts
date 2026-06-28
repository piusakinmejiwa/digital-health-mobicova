import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database', () => ({
  query: vi.fn(),
  pool: { query: vi.fn(async () => ({ rows: [] })), connect: vi.fn(), end: vi.fn(), on: vi.fn() },
}));

import request from 'supertest';
import { query } from '../../src/config/database';
import app from '../../src/app';
import { buildQueryImpl, staffToken, memberToken } from './helpers';

beforeEach(() => {
  vi.mocked(query).mockImplementation(buildQueryImpl({ memberList: [] }) as never);
});

// The authenticate() middleware is the front door to every tenant route.
describe('staff auth enforcement (GET /api/v1/members)', () => {
  it('rejects a request with no token (401)', async () => {
    const r = await request(app).get('/api/v1/members');
    expect(r.status).toBe(401);
  });

  it('rejects a malformed bearer token (401)', async () => {
    const r = await request(app).get('/api/v1/members').set('Authorization', 'Bearer not.a.jwt');
    expect(r.status).toBe(401);
  });

  it('rejects a member-scope token on a staff route (401)', async () => {
    const r = await request(app).get('/api/v1/members').set('Authorization', `Bearer ${memberToken()}`);
    expect(r.status).toBe(401);
  });

  it('accepts a valid staff token (200)', async () => {
    const r = await request(app).get('/api/v1/members').set('Authorization', `Bearer ${staffToken()}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });
});
