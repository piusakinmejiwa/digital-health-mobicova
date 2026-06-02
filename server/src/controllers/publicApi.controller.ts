import { Request, Response } from 'express';
import { query } from '../config/database';

// The public REST API: stable, tenant-scoped, read-only endpoints an insurer's
// own systems can poll. Every handler is pinned to req.apiOrgId (set by the
// API-key middleware), so a key can only ever read its own organisation's data.

// Shared pagination: ?limit=1..200 (default 50), ?offset>=0. Returned alongside
// the data so clients can page deterministically.
function pagination(req: Request): { limit: number; offset: number } {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
  return { limit, offset };
}

// GET /members
export async function listMembers(req: Request, res: Response): Promise<void> {
  const orgId = req.apiOrgId!;
  const { limit, offset } = pagination(req);
  const result = await query(
    `SELECT id, full_name, phone, email, date_of_birth, gender, channel, status, created_at
     FROM members WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [orgId, limit, offset]
  );
  const total = await query('SELECT COUNT(*)::int AS n FROM members WHERE org_id = $1', [orgId]);
  res.json({ data: result.rows, pagination: { limit, offset, total: total.rows[0].n } });
}

// GET /members/:id
export async function getMember(req: Request, res: Response): Promise<void> {
  const orgId = req.apiOrgId!;
  const result = await query(
    `SELECT id, full_name, phone, email, date_of_birth, gender, channel, status,
            blood_group, allergies, chronic_conditions, current_medications, created_at
     FROM members WHERE id = $1 AND org_id = $2`,
    [String(req.params.id), orgId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  res.json({ data: result.rows[0] });
}

// GET /enrolments
export async function listEnrolments(req: Request, res: Response): Promise<void> {
  const orgId = req.apiOrgId!;
  const { limit, offset } = pagination(req);
  const result = await query(
    `SELECT e.id, e.member_id, m.full_name AS member_name, e.plan_id, pl.name AS plan_name,
            pl.plan_type, pl.monthly_premium, pl.currency, pl.underwriter,
            e.status, e.payment_status, e.enrolled_at
     FROM enrolments e
     JOIN members m ON e.member_id = m.id
     JOIN insurance_plans pl ON e.plan_id = pl.id
     WHERE e.org_id = $1 ORDER BY e.enrolled_at DESC LIMIT $2 OFFSET $3`,
    [orgId, limit, offset]
  );
  const total = await query('SELECT COUNT(*)::int AS n FROM enrolments WHERE org_id = $1', [orgId]);
  res.json({ data: result.rows, pagination: { limit, offset, total: total.rows[0].n } });
}

// GET /claims  (?status= optional)
export async function listClaims(req: Request, res: Response): Promise<void> {
  const orgId = req.apiOrgId!;
  const { limit, offset } = pagination(req);
  const params: unknown[] = [orgId];
  let where = 'WHERE c.org_id = $1';
  if (req.query.status) {
    params.push(String(req.query.status));
    where += ` AND c.status = $${params.length}`;
  }
  params.push(limit, offset);
  const result = await query(
    `SELECT c.id, c.reference, c.member_id, m.full_name AS member_name, c.claim_type,
            c.provider_name, c.service_date, c.amount, c.currency, c.status,
            c.plan_id, pl.name AS plan_name, pl.underwriter, c.submitted_via,
            c.decided_at, c.created_at, c.updated_at
     FROM claims c
     JOIN members m ON c.member_id = m.id
     LEFT JOIN insurance_plans pl ON c.plan_id = pl.id
     ${where} ORDER BY c.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params as any[]
  );
  const total = await query('SELECT COUNT(*)::int AS n FROM claims WHERE org_id = $1', [orgId]);
  res.json({ data: result.rows, pagination: { limit, offset, total: total.rows[0].n } });
}

// GET /claims/:id
export async function getClaim(req: Request, res: Response): Promise<void> {
  const orgId = req.apiOrgId!;
  const result = await query(
    `SELECT c.id, c.reference, c.member_id, m.full_name AS member_name, c.claim_type,
            c.provider_name, c.service_date, c.amount, c.currency, c.status, c.decision_note,
            c.plan_id, pl.name AS plan_name, pl.underwriter, c.submitted_via,
            c.decided_at, c.created_at, c.updated_at
     FROM claims c
     JOIN members m ON c.member_id = m.id
     LEFT JOIN insurance_plans pl ON c.plan_id = pl.id
     WHERE c.id = $1 AND c.org_id = $2`,
    [String(req.params.id), orgId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Claim not found' });
    return;
  }
  res.json({ data: result.rows[0] });
}
