import { describe, it, expect } from 'vitest';
import { diffMigrations } from '../src/lib/migrationStatus';

// The drift detector that stops code shipping ahead of hand-applied SQL.
describe('diffMigrations', () => {
  it('reports nothing when files and applied match', () => {
    const r = diffMigrations(['001_a.sql', '002_b.sql'], ['001_a.sql', '002_b.sql']);
    expect(r.pending).toEqual([]);
    expect(r.unknown).toEqual([]);
  });

  it('flags repo files not yet applied as pending', () => {
    const r = diffMigrations(['001_a.sql', '002_b.sql', '003_c.sql'], ['001_a.sql']);
    expect(r.pending).toEqual(['002_b.sql', '003_c.sql']);
    expect(r.unknown).toEqual([]);
  });

  it('flags applied rows with no matching file as unknown', () => {
    const r = diffMigrations(['001_a.sql'], ['001_a.sql', '999_gone.sql']);
    expect(r.pending).toEqual([]);
    expect(r.unknown).toEqual(['999_gone.sql']);
  });

  it('treats a fresh DB (nothing applied) as everything pending', () => {
    const r = diffMigrations(['001_a.sql', '002_b.sql'], []);
    expect(r.pending).toEqual(['001_a.sql', '002_b.sql']);
  });

  it('is order-independent (results are sorted)', () => {
    const r = diffMigrations(['002_b.sql', '001_a.sql'], []);
    expect(r.pending).toEqual(['001_a.sql', '002_b.sql']);
  });
});
