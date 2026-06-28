// `npm run migrate:status` — prints migration drift between the repo and the
// database it's pointed at (DATABASE_URL). Read-only; applies nothing. Run it
// against prod after a deploy to confirm the hand-applied SQL is in sync.

import { pool } from '../config/database';
import { getMigrationStatus } from '../lib/migrationStatus';

async function main() {
  const m = await getMigrationStatus();
  if (!m.available) {
    console.error('Could not read migrations (directory or database unavailable).');
    process.exitCode = 2;
    return;
  }

  console.log(`Migrations: ${m.applied}/${m.total} applied.`);
  if (m.pending.length === 0 && m.unknown.length === 0) {
    console.log('✓ In sync — nothing pending.');
  }
  if (m.pending.length > 0) {
    console.log(`\n⚠️  ${m.pending.length} PENDING (in the repo, not applied):`);
    for (const p of m.pending) console.log(`   · ${p}`);
    console.log('\nApply the matching paste editions in Supabase (server/src/db/sql/).');
    process.exitCode = 1; // non-zero so this can gate a deploy check
  }
  if (m.unknown.length > 0) {
    console.log(`\nℹ️  ${m.unknown.length} applied but with no file in this build:`);
    for (const u of m.unknown) console.log(`   · ${u}`);
  }
}

main()
  .catch((err) => {
    console.error('migrate:status failed:', err);
    process.exitCode = 2;
  })
  .finally(() => pool.end());
