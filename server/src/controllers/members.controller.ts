import { Request, Response } from 'express';
import { query, pool } from '../config/database';
import { sendMemberWelcome } from '../lib/onboarding';

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
  const {
    fullName, phone, email, dateOfBirth, gender, channel,
    bloodGroup, allergies, chronicConditions, currentMedications,
  } = req.body;

  const result = await query(
    `INSERT INTO members (org_id, full_name, phone, email, date_of_birth, gender, channel,
                          blood_group, allergies, chronic_conditions, current_medications)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      orgId, fullName, phone || '', email || '', dateOfBirth || null, gender || '',
      channel || 'app', bloodGroup || '', allergies || [], chronicConditions || [], currentMedications || [],
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
  const orgId = req.user!.orgId;
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

    valid.push([
      orgId, fullName, importStr(r.phone), importStr(r.email), dob || null,
      importStr(r.gender), channel, importStr(r.bloodGroup),
      importArray(r.allergies), importArray(r.chronicConditions), importArray(r.currentMedications),
    ]);
  });

  if (valid.length === 0) {
    res.status(400).json({ inserted: 0, skipped, total: rows.length, error: 'No valid rows to import.' });
    return;
  }

  // All valid rows succeed together or not at all.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const values of valid) {
      await client.query(
        `INSERT INTO members (org_id, full_name, phone, email, date_of_birth, gender, channel,
                              blood_group, allergies, chronic_conditions, current_medications)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        values
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(201).json({ inserted: valid.length, skipped, total: rows.length });
}

export async function updateMember(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;
  const {
    fullName, phone, email, dateOfBirth, gender, channel,
    bloodGroup, allergies, chronicConditions, currentMedications, status,
  } = req.body;

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
       updated_at = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING *`,
    [id, orgId, fullName, phone, email, dateOfBirth, gender, channel,
     bloodGroup, allergies, chronicConditions, currentMedications, status]
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
