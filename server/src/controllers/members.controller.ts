import { Request, Response } from 'express';
import { query, pool } from '../config/database';
import { sendMemberWelcome } from '../lib/onboarding';
import { newMembershipId, generateMembershipId } from '../lib/membership';
import { recordAudit } from '../lib/audit';
import { geocode } from '../lib/geo';
import { checkMemberSeats, seatLimitError } from '../lib/plans';
import { notify } from '../lib/notify';

// Platform admins "viewing as" a tenant (actingAs set) bypass plan limits so
// support work is never blocked by the tenant's own cap.
function bypassLimits(req: Request): boolean {
  return Boolean(req.user?.actingAs);
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const result = await query(
    `SELECT m.*,
            (SELECT COUNT(*)::int FROM consultations c WHERE c.member_id = m.id) AS consultation_count,
            (SELECT COUNT(*)::int FROM enrolments e WHERE e.member_id = m.id) AS enrolment_count
     FROM members m WHERE m.org_id = $1 ORDER BY m.created_at DESC`,
    [orgId]
  );
  res.json(result.rows);
}

export async function getMember(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;

  const result = await query(`SELECT * FROM members WHERE id = $1 AND org_id = $2`, [id, orgId]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const consultations = await query(
    `SELECT c.*, p.name AS partner_name
     FROM consultations c LEFT JOIN partners p ON c.partner_id = p.id
     WHERE c.member_id = $1 ORDER BY c.created_at DESC`,
    [id]
  );
  const enrolments = await query(
    `SELECT e.*, pl.name AS plan_name, pl.plan_type, pl.monthly_premium, pl.currency, pl.underwriter
     FROM enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id
     WHERE e.member_id = $1 ORDER BY e.enrolled_at DESC`,
    [id]
  );
  const triage = await query(
    `SELECT id, triage_level, recommendation, engine, created_at
     FROM triage_sessions WHERE member_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  const prescriptions = await query(
    `SELECT * FROM prescriptions WHERE member_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  res.json({
    ...result.rows[0],
    consultations: consultations.rows,
    enrolments: enrolments.rows,
    triageSessions: triage.rows,
    prescriptions: prescriptions.rows,
  });
}

export async function createMember(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;

  // Hard seat cap — block creating a member past the plan limit (Enterprise is
  // unlimited; platform admins acting in the tenant bypass).
  if (!bypassLimits(req)) {
    const seats = await checkMemberSeats(orgId, 1);
    if (seats.exceeded) { res.status(403).json(seatLimitError(seats, 1)); return; }
  }

  const {
    fullName, phone, email, dateOfBirth, gender, channel,
    bloodGroup, allergies, chronicConditions, currentMedications, address, city, state, lga,
  } = req.body;

  // Geocode the address so prescriptions can route to the nearest pharmacy.
  const addr = String(address || '').trim();
  const town = String(city || '').trim();
  const st = String(state || '').slice(0, 60);
  const localGov = String(lga || '').slice(0, 80);
  const coords = (addr || town || st) ? await geocode([addr, town, localGov, st].filter(Boolean).join(', ')) : null;

  const membershipId = await newMembershipId(orgId);
  const result = await query(
    `INSERT INTO members (org_id, full_name, phone, email, date_of_birth, gender, channel,
                          blood_group, allergies, chronic_conditions, current_medications, membership_id,
                          address, city, state, lga, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING *`,
    [
      orgId, fullName, phone || '', email || '', dateOfBirth || null, gender || '',
      channel || 'app', bloodGroup || '', allergies || [], chronicConditions || [], currentMedications || [],
      membershipId, addr, town, st, localGov, coords?.lat ?? null, coords?.lng ?? null,
    ]
  );
  const member = result.rows[0];

  // Best-effort welcome email with portal access instructions (if they have one).
  if (member.email) {
    const org = await query('SELECT name, join_code FROM organisations WHERE id = $1', [orgId]);
    await sendMemberWelcome({
      email: member.email, fullName: member.full_name,
      orgName: org.rows[0]?.name || 'MobiCova', joinCode: org.rows[0]?.join_code || '',
    });
  }

  await recordAudit(req, {
    action: 'member.create', targetType: 'member', targetId: member.id,
    targetLabel: member.full_name, orgId, metadata: { channel: member.channel, membershipId },
  });

  // Usage-threshold alert (ties into plan limits): notify once per (limit,
  // threshold) as the org crosses 80% / 90% / 100% of its member seat cap.
  if (!bypassLimits(req)) {
    const after = await checkMemberSeats(orgId, 0);
    if (!after.unlimited && after.limit > 0) {
      const pct = (after.used / after.limit) * 100;
      const threshold = pct >= 100 ? 100 : pct >= 90 ? 90 : pct >= 80 ? 80 : 0;
      if (threshold) {
        void notify({
          orgId, category: 'billing',
          severity: threshold >= 100 ? 'critical' : 'warn',
          title: threshold >= 100 ? 'Member limit reached' : `Member usage at ${threshold}%`,
          body: `${after.used.toLocaleString()} of ${after.limit.toLocaleString()} members on your ${after.tier.name} plan.`
            + (threshold >= 100 ? ' New members are blocked until you upgrade.' : ''),
          href: '/settings/billing',
          dedupeKey: `usage:members:${after.limit}:${threshold}`,
        });
      }
    }
  }

  res.status(201).json(member);
}

// Bulk member import. Accepts a `members` array (parsed from a CSV upload on
// the client), validates every row, and inserts the valid ones in a single
// transaction attributed to the caller's organisation. Invalid rows are skipped
// and reported back with 1-based row numbers so the uploader can fix and retry.
const IMPORT_ALLOWED_CHANNELS = new Set(['app', 'whatsapp', 'ussd', 'web']);
const IMPORT_MAX_ROWS = 1000;
const IMPORT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function importStr(v: unknown): string {
  if (v == null) return '';
  return (typeof v === 'string' ? v : String(v)).trim();
}
function importArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = importStr(v);
  if (!s) return [];
  // Within a CSV cell, list values are separated by ';' (commas delimit columns).
  return s.split(';').map((x) => x.trim()).filter(Boolean);
}

export async function importMembers(req: Request, res: Response): Promise<void> {
  // Tenant self-service import → enforce the plan's seat cap.
  return runMemberImport(req, res, req.user!.orgId, true);
}

// Platform-admin variant: import members into a SPECIFIC target org (onboarding a
// tenant on their behalf), rather than the caller's own org. Platform admin →
// seat cap is not enforced (deliberate onboarding action).
export async function adminImportOrgMembers(req: Request, res: Response): Promise<void> {
  const orgId = String(req.params.id);
  const exists = await query('SELECT 1 FROM organisations WHERE id = $1', [orgId]);
  if (exists.rows.length === 0) { res.status(404).json({ error: 'Organisation not found' }); return; }
  return runMemberImport(req, res, orgId, false);
}

// Platform-admin: list members of ANY org (cross-org, not limited to own org).
// Optional ?q= searches name / phone / email / membership id.
export async function adminListOrgMembers(req: Request, res: Response): Promise<void> {
  const orgId = String(req.params.id);
  const q = String(req.query.q || '').trim();
  const params: unknown[] = [orgId];
  let where = 'org_id = $1';
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (full_name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2 OR membership_id ILIKE $2)`;
  }
  const r = await query(
    `SELECT id, membership_id, full_name, phone, email, gender, date_of_birth, channel, status, created_at
       FROM members WHERE ${where} ORDER BY created_at DESC LIMIT 100`,
    params
  );
  res.json({ members: r.rows });
}

// Platform-admin: update a member in ANY org (e.g. fix a phone number).
export async function adminUpdateOrgMember(req: Request, res: Response): Promise<void> {
  const orgId = String(req.params.id);
  const memberId = String(req.params.memberId);
  const b = req.body || {};
  const r = await query(
    `UPDATE members SET
       full_name     = COALESCE($3, full_name),
       phone         = COALESCE($4, phone),
       email         = COALESCE($5, email),
       gender        = COALESCE($6, gender),
       date_of_birth = COALESCE($7, date_of_birth),
       channel       = COALESCE($8, channel),
       status        = COALESCE($9, status),
       updated_at    = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING id, membership_id, full_name, phone, email, gender, date_of_birth, channel, status`,
    [memberId, orgId,
     b.fullName ?? null, b.phone ?? null, b.email ?? null, b.gender ?? null,
     b.dateOfBirth || null, b.channel ?? null, b.status ?? null]
  );
  if (r.rows.length === 0) { res.status(404).json({ error: 'Member not found in this organisation' }); return; }
  await recordAudit(req, { action: 'member.update', targetType: 'member', targetId: memberId, targetLabel: r.rows[0].full_name, orgId });
  res.json(r.rows[0]);
}

async function runMemberImport(req: Request, res: Response, orgId: string, enforce: boolean): Promise<void> {
  // Dry run: validate + preview only, never write. Lets onboarding teams check a
  // partner's CSV (e.g. AXA's pilot cohort) before committing.
  const dryRun = Boolean(req.body?.dryRun);
  const rows: unknown[] = Array.isArray(req.body?.members) ? req.body.members : [];

  if (rows.length === 0) {
    res.status(400).json({ error: 'No rows to import. Provide a non-empty "members" array.' });
    return;
  }
  if (rows.length > IMPORT_MAX_ROWS) {
    res.status(400).json({ error: `Too many rows: ${rows.length}. The maximum per import is ${IMPORT_MAX_ROWS}.` });
    return;
  }

  const valid: unknown[][] = [];
  const skipped: { row: number; reason: string }[] = [];
  // Non-blocking warnings: the row still imports, but something needs attention.
  const warnings: { row: number; reason: string }[] = [];

  rows.forEach((raw, i) => {
    const rowNum = i + 1;
    const r = (raw ?? {}) as Record<string, unknown>;
    const fullName = importStr(r.fullName);
    if (!fullName) {
      skipped.push({ row: rowNum, reason: 'Full name is required' });
      return;
    }
    const dob = importStr(r.dateOfBirth);
    if (dob && !IMPORT_DATE_RE.test(dob)) {
      skipped.push({ row: rowNum, reason: `Invalid date of birth "${dob}" (expected YYYY-MM-DD)` });
      return;
    }
    let channel = importStr(r.channel).toLowerCase() || 'app';
    if (!IMPORT_ALLOWED_CHANNELS.has(channel)) channel = 'app';

    const phone = importStr(r.phone);
    const email = importStr(r.email);
    // Imported, but un-contactable: no phone and no email means no login code
    // can be delivered (and no phone = no USSD/WhatsApp identity either).
    if (!phone && !email) {
      warnings.push({ row: rowNum, reason: `${fullName}: no phone or email — cannot receive a login code` });
    }

    valid.push([
      orgId, fullName, phone, email, dob || null,
      importStr(r.gender), channel, importStr(r.bloodGroup),
      importArray(r.allergies), importArray(r.chronicConditions), importArray(r.currentMedications),
    ]);
  });

  // Seat-cap check for the valid rows (only enforced on tenant self-service
  // imports). Surfaced in the dry run as a warning so uploaders see it before
  // committing; blocks the real import if it would push past the plan limit.
  const seats = enforce ? await checkMemberSeats(orgId, valid.length) : null;

  // Dry run stops here: report what *would* import, with a small preview, and
  // every skipped row + reason — without touching the database.
  if (dryRun) {
    res.json({
      dryRun: true,
      wouldImport: valid.length,
      skipped,
      warnings,
      total: rows.length,
      preview: valid.slice(0, 8).map((v) => ({ fullName: v[1], phone: v[2], email: v[3] })),
      seatLimit: seats && seats.exceeded ? seatLimitError(seats, valid.length) : null,
    });
    return;
  }

  if (valid.length === 0) {
    res.status(400).json({ inserted: 0, skipped, total: rows.length, error: 'No valid rows to import.' });
    return;
  }

  if (seats && seats.exceeded) {
    res.status(403).json(seatLimitError(seats, valid.length));
    return;
  }

  // Membership IDs for the batch — prefix from the org name, unique per member.
  const orgRow = await query('SELECT name FROM organisations WHERE id = $1', [orgId]);
  const orgName = orgRow.rows[0]?.name || 'MobiCova';
  const reserved = new Set<string>();

  // All valid rows succeed together or not at all.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const values of valid) {
      const membershipId = await generateMembershipId(orgName, reserved);
      await client.query(
        `INSERT INTO members (org_id, full_name, phone, email, date_of_birth, gender, channel,
                              blood_group, allergies, chronic_conditions, current_medications, membership_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [...values, membershipId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await recordAudit(req, {
    action: 'member.import', orgId, metadata: { inserted: valid.length, skipped, total: rows.length },
  });

  res.status(201).json({ inserted: valid.length, skipped, warnings, total: rows.length });
}

export async function updateMember(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;
  const {
    fullName, phone, email, dateOfBirth, gender, channel,
    bloodGroup, allergies, chronicConditions, currentMedications, status, address, city, state, lga,
  } = req.body;

  // Re-geocode when an address/city is supplied (so coords stay in sync).
  let lat: number | null | undefined;
  let lng: number | null | undefined;
  if (address !== undefined || city !== undefined) {
    const coords = await geocode([String(address || '').trim(), String(city || '').trim()].filter(Boolean).join(', '));
    lat = coords?.lat ?? null;
    lng = coords?.lng ?? null;
  }

  const result = await query(
    `UPDATE members SET
       full_name = COALESCE($3, full_name),
       phone = COALESCE($4, phone),
       email = COALESCE($5, email),
       date_of_birth = COALESCE($6, date_of_birth),
       gender = COALESCE($7, gender),
       channel = COALESCE($8, channel),
       blood_group = COALESCE($9, blood_group),
       allergies = COALESCE($10, allergies),
       chronic_conditions = COALESCE($11, chronic_conditions),
       current_medications = COALESCE($12, current_medications),
       status = COALESCE($13, status),
       address = COALESCE($14, address),
       city = COALESCE($15, city),
       latitude = COALESCE($16, latitude),
       longitude = COALESCE($17, longitude),
       state = COALESCE($18, state),
       lga = COALESCE($19, lga),
       updated_at = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING *`,
    [id, orgId, fullName, phone, email, dateOfBirth, gender, channel,
     bloodGroup, allergies, chronicConditions, currentMedications, status,
     address ?? null, city ?? null, lat ?? null, lng ?? null,
     state ?? null, lga ?? null]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  res.json(result.rows[0]);
}

export async function deleteMember(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;
  const result = await query(
    `DELETE FROM members WHERE id = $1 AND org_id = $2 RETURNING id`,
    [id, orgId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  res.json({ message: 'Member deleted' });
}
