import { pool, query } from '../config/database';
import { uniqueSlug, generateJoinCode } from '../lib/org';

// ── Unified organisation model — Phase 1 data migration ──────────────────────
// One-off, IDEMPOTENT backfill that folds the legacy `partners`/`providers`
// world into the unified `organisations` model. Safe to re-run.
//
// Run AFTER migrations 026–028 are applied:  npm run migrate:org-model
//
// What it does:
//   1. Normalises legacy type values (employer→company, insurer→underwriter).
//   2. Creates one organisation per partner (deduping insurers onto the existing
//      underwriter org instead of making a second copy of the same insurer, etc.).
//   3. Links providers to their org (many-to-many; a doctor may span clinics).
//   4. Backfills org-based routing on consultations / prescriptions / plans.

const CATEGORY_TO_TYPE: Record<string, string> = {
  telemedicine: 'clinic',
  pharmacy: 'pharmacy',
  insurer: 'underwriter',
  diagnostics: 'diagnostics',
  ehr: 'ehr',
  distribution: 'distribution',
};

async function run(): Promise<void> {
  console.log('Unified org model — data migration starting…');

  // 1. Normalise legacy type values to the canonical set.
  await query("UPDATE organisations SET type = 'company' WHERE type = 'employer'");
  await query("UPDATE organisations SET type = 'underwriter' WHERE type = 'insurer'");

  // 2. Create an organisation per partner. Insurers dedupe onto an existing
  //    underwriter org (by name) rather than creating a duplicate.
  const partners = (await query('SELECT id, name, category FROM partners ORDER BY name')).rows as
    { id: string; name: string; category: string }[];

  let created = 0;
  let linked = 0;
  for (const p of partners) {
    const type = CATEGORY_TO_TYPE[p.category] || 'company';

    // Already migrated?
    const existing = await query('SELECT id FROM organisations WHERE legacy_partner_id = $1 LIMIT 1', [p.id]);
    if (existing.rows.length > 0) continue;

    if (type === 'underwriter') {
      const match = await query(
        `SELECT id FROM organisations
          WHERE type = 'underwriter' AND legacy_partner_id IS NULL
            AND (lower(name) = lower($1) OR name ILIKE $1 || '%' OR $1 ILIKE name || '%')
          ORDER BY (lower(name) = lower($1)) DESC, length(name) ASC
          LIMIT 1`,
        [p.name]
      );
      if (match.rows.length > 0) {
        await query('UPDATE organisations SET legacy_partner_id = $1 WHERE id = $2', [p.id, match.rows[0].id]);
        linked += 1;
        continue;
      }
    }

    const slug = await uniqueSlug(p.name);
    const joinCode = await generateJoinCode();
    await query(
      `INSERT INTO organisations (name, slug, type, country, join_code, legacy_partner_id)
       VALUES ($1, $2, $3, 'Nigeria', $4, $5)`,
      [p.name, slug, type, joinCode, p.id]
    );
    created += 1;
  }
  console.log(`  organisations: ${created} created, ${linked} linked to existing underwriters`);

  // 3. Link providers to their organisation (many-to-many; primary = home org).
  const links = await query(`
    INSERT INTO provider_organisations (provider_id, org_id, is_primary)
    SELECT pr.id, o.id, true
      FROM providers pr
      JOIN organisations o ON o.legacy_partner_id = pr.partner_id
     WHERE pr.partner_id IS NOT NULL
    ON CONFLICT (provider_id, org_id) DO NOTHING
  `);
  console.log(`  provider→org links: ${links.rowCount ?? 0} added`);

  // 4a. Consultation routing → clinic org (from the provider, else the partner).
  await query(`
    UPDATE consultations c
       SET provider_org_id = po.org_id
      FROM provider_organisations po
     WHERE po.provider_id = c.provider_id AND po.is_primary = true
       AND c.provider_org_id IS NULL AND c.provider_id IS NOT NULL
  `);
  await query(`
    UPDATE consultations c
       SET provider_org_id = o.id
      FROM organisations o
     WHERE o.legacy_partner_id = c.partner_id
       AND c.provider_org_id IS NULL
  `);

  // 4b. Prescription routing → pharmacy org (by id, then by name fallback).
  await query(`
    UPDATE prescriptions rx
       SET pharmacy_org_id = o.id
      FROM organisations o
     WHERE o.legacy_partner_id = rx.pharmacy_partner_id
       AND rx.pharmacy_org_id IS NULL AND rx.pharmacy_partner_id IS NOT NULL
  `);
  await query(`
    UPDATE prescriptions rx
       SET pharmacy_org_id = o.id
      FROM organisations o
     WHERE o.type = 'pharmacy' AND lower(o.name) = lower(rx.pharmacy_partner)
       AND rx.pharmacy_org_id IS NULL AND COALESCE(rx.pharmacy_partner, '') <> ''
  `);

  // 4c. Plan underwriter → underwriter org (by name).
  await query(`
    UPDATE insurance_plans ip
       SET underwriter_org_id = o.id
      FROM organisations o
     WHERE o.type = 'underwriter'
       AND (lower(o.name) = lower(ip.underwriter) OR o.name ILIKE ip.underwriter || '%' OR ip.underwriter ILIKE o.name || '%')
       AND ip.underwriter_org_id IS NULL AND COALESCE(ip.underwriter, '') <> ''
  `);

  console.log('Unified org model — data migration complete.');
  await pool.end();
}

run().catch((err) => {
  console.error('Org-model migration failed:', err);
  process.exit(1);
});
