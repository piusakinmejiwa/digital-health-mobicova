// Migration drift detection. The deploy workflow applies migrations by hand in
// Supabase, so the real risk is shipping code that expects a migration nobody
// ran yet. This compares the .sql files in the repo against the _migrations
// table and reports the gap — surfaced at boot, on /health, and via a CLI.

import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

export interface MigrationStatus {
  available: boolean;  // could we resolve both the files and the table
  applied: number;
  total: number;
  pending: string[];   // present in the repo, not yet recorded as applied
  unknown: string[];   // recorded as applied, but no matching file in the repo
  ok: boolean;         // nothing pending
}

// Pure set-diff — the testable core. `files` = .sql migrations in the repo,
// `applied` = names recorded in the _migrations table.
export function diffMigrations(files: string[], applied: string[]): {
  pending: string[]; unknown: string[];
} {
  const appliedSet = new Set(applied);
  const fileSet = new Set(files);
  return {
    pending: files.filter((f) => !appliedSet.has(f)).sort(),
    unknown: applied.filter((n) => !fileSet.has(n)).sort(),
  };
}

// The migrations directory ships as source (the migrate script runs via tsx), so
// it lives under src/ at runtime. Resolve it defensively across cwd/compiled layouts.
function findMigrationsDir(): string | null {
  const candidates = [
    path.join(process.cwd(), 'src', 'db', 'migrations'),
    path.join(__dirname, '..', '..', 'src', 'db', 'migrations'),
    path.join(__dirname, '..', 'db', 'migrations'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

const UNAVAILABLE: MigrationStatus = {
  available: false, applied: 0, total: 0, pending: [], unknown: [], ok: true,
};

export async function getMigrationStatus(): Promise<MigrationStatus> {
  const dir = findMigrationsDir();
  if (!dir) return UNAVAILABLE;

  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    return UNAVAILABLE;
  }

  let applied: string[];
  try {
    const r = await pool.query('SELECT name FROM _migrations');
    applied = r.rows.map((x: { name: string }) => x.name);
  } catch (err) {
    // Fresh DB: the table doesn't exist yet ⇒ everything is pending. Any other
    // error (e.g. the DB is unreachable) is "unknown" — don't cry wolf.
    if ((err as { code?: string })?.code === '42P01') {
      applied = [];
    } else {
      return UNAVAILABLE;
    }
  }

  const { pending, unknown } = diffMigrations(files, applied);
  return {
    available: true,
    applied: applied.length,
    total: files.length,
    pending,
    unknown,
    ok: pending.length === 0,
  };
}
