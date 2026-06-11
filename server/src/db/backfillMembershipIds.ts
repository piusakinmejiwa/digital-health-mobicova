import { pool, query } from '../config/database';
import { generateMembershipId } from '../lib/membership';

// One-off, idempotent: assign a membership ID to every member that doesn't have
// one yet (prefix from their organisation name + 6 unique digits).
// Run after migration 031:  npm run backfill:membership-ids
async function run(): Promise<void> {
  const rows = (await query(
    `SELECT m.id, o.name AS org_name
       FROM members m JOIN organisations o ON m.org_id = o.id
      WHERE m.membership_id IS NULL
      ORDER BY o.name`
  )).rows as { id: string; org_name: string }[];

  console.log(`Backfilling membership IDs for ${rows.length} member(s)…`);
  const reserved = new Set<string>();
  let n = 0;
  for (const r of rows) {
    const id = await generateMembershipId(r.org_name || 'MobiCova', reserved);
    await query('UPDATE members SET membership_id = $2 WHERE id = $1 AND membership_id IS NULL', [r.id, id]);
    n += 1;
  }
  console.log(`Done. ${n} membership ID(s) assigned.`);
  await pool.end();
}

run().catch((err) => {
  console.error('Membership-ID backfill failed:', err);
  process.exit(1);
});
