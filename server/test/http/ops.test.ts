import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB layer before importing the app (also avoids the real pool's
// on('error') → process.exit handler ever being registered).
vi.mock('../../src/config/database', () => ({
  query: vi.fn(),
  pool: { query: vi.fn(async () => ({ rows: [] })), connect: vi.fn(), end: vi.fn(), on: vi.fn() },
}));

import request from 'supertest';
import { query } from '../../src/config/database';
import app from '../../src/app';
import { buildQueryImpl } from './helpers';

beforeEach(() => {
  vi.mocked(query).mockImplementation(buildQueryImpl({}) as never);
});

describe('ops / health endpoints', () => {
  it('GET /healthz is a dependency-free 200 (liveness)', async () => {
    const r = await request(app).get('/healthz');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });

  it('GET /readyz returns 200 when the database is reachable', async () => {
    const r = await request(app).get('/readyz');
    expect(r.status).toBe(200);
    expect(r.body.db).toBe(true);
  });

  it('GET /readyz returns 503 when the database is down', async () => {
    vi.mocked(query).mockImplementation(buildQueryImpl({ failSelect1: true }) as never);
    const r = await request(app).get('/readyz');
    expect(r.status).toBe(503);
    expect(r.body.db).toBe(false);
  });

  it('GET /health reports integrations + migration status', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.integrations).toBeDefined();
    expect(r.body.migrations).toBeDefined();
    expect(typeof r.body.integrations.errorTracking).toBe('boolean');
  });
});
