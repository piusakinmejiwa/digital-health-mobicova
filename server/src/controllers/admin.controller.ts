import { Request, Response } from 'express';
import { query } from '../config/database';
import { recordAudit } from '../lib/audit';

// Platform-admin CRUD for the global catalog: partner ecosystem records and
// insurance plans. All routes here sit behind authenticate + requirePlatformAdmin
// (see admin.routes.ts), so these handlers assume the caller is authorised.

// Accepts benefits as an array, or a string with newline/comma separators, and
// normalises to a clean string[] for the TEXT[] column.
function parseBenefits(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
  if (typeof input === 'string') return input.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
  return [];
}

// ---------- Partners ----------

export async function adminListPartners(_req: Request, res: Response): Promise<void> {
  // Includes inactive partners so admins can manage everything.
  const result = await query('SELECT * FROM partners ORDER BY category, name');
  res.json(result.rows);
}

export async function adminCreatePartner(req: Request, res: Response): Promise<void> {
  const { name, category, description = '', coverage = '', licence = '', status = 'active' } = req.body;
  if (!name || !category) {
    res.status(400).json({ error: 'name and category are required' });
    return;
  }
  const result = await query(
    `INSERT INTO partners (name, category, description, coverage, licence, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, category, description, coverage, licence, status]
  );
  await recordAudit(req, { action: 'partner.create', targetType: 'partner', targetId: result.rows[0].id, targetLabel: result.rows[0].name });
  res.status(201).json(result.rows[0]);
}

export async function adminUpdatePartner(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const existing = await query('SELECT * FROM partners WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Partner not found' });
    return;
  }
  const cur = existing.rows[0];
  const b = req.body;
  const result = await query(
    `UPDATE partners
        SET name = $2, category = $3, description = $4, coverage = $5, licence = $6, status = $7
      WHERE id = $1 RETURNING *`,
    [
      id,
      b.name ?? cur.name,
      b.category ?? cur.category,
      b.description ?? cur.description,
      b.coverage ?? cur.coverage,
      b.licence ?? cur.licence,
      b.status ?? cur.status,
    ]
  );
  await recordAudit(req, { action: 'partner.update', targetType: 'partner', targetId: id, targetLabel: result.rows[0].name });
  res.json(result.rows[0]);
}

export async function adminDeletePartner(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const result = await query('DELETE FROM partners WHERE id = $1 RETURNING id, name', [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Partner not found' });
    return;
  }
  await recordAudit(req, { action: 'partner.delete', targetType: 'partner', targetId: id, targetLabel: result.rows[0].name });
  res.json({ deleted: true });
}

// ---------- Insurance plans ----------

export async function adminListPlans(_req: Request, res: Response): Promise<void> {
  // Includes inactive plans (unlike the public /insurance/plans endpoint).
  const result = await query('SELECT * FROM insurance_plans ORDER BY monthly_premium');
  res.json(result.rows);
}

export async function adminCreatePlan(req: Request, res: Response): Promise<void> {
  const {
    name, plan_type, underwriter, monthly_premium,
    currency = 'NGN', cover_amount = 0, description = '', commission_rate = 15, is_active = true,
  } = req.body;
  if (!name || !plan_type || !underwriter || monthly_premium == null) {
    res.status(400).json({ error: 'name, plan_type, underwriter and monthly_premium are required' });
    return;
  }
  const benefits = parseBenefits(req.body.benefits);
  const result = await query(
    `INSERT INTO insurance_plans
       (name, plan_type, underwriter, monthly_premium, currency, cover_amount, benefits, description, commission_rate, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [name, plan_type, underwriter, monthly_premium, currency, cover_amount, benefits, description, commission_rate, is_active]
  );
  await recordAudit(req, { action: 'plan.create', targetType: 'plan', targetId: result.rows[0].id, targetLabel: result.rows[0].name });
  res.status(201).json(result.rows[0]);
}

export async function adminUpdatePlan(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const existing = await query('SELECT * FROM insurance_plans WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }
  const cur = existing.rows[0];
  const b = req.body;
  const benefits = b.benefits !== undefined ? parseBenefits(b.benefits) : cur.benefits;
  const result = await query(
    `UPDATE insurance_plans
        SET name = $2, plan_type = $3, underwriter = $4, monthly_premium = $5, currency = $6,
            cover_amount = $7, benefits = $8, description = $9, commission_rate = $10, is_active = $11
      WHERE id = $1 RETURNING *`,
    [
      id,
      b.name ?? cur.name,
      b.plan_type ?? cur.plan_type,
      b.underwriter ?? cur.underwriter,
      b.monthly_premium ?? cur.monthly_premium,
      b.currency ?? cur.currency,
      b.cover_amount ?? cur.cover_amount,
      benefits,
      b.description ?? cur.description,
      b.commission_rate ?? cur.commission_rate,
      b.is_active ?? cur.is_active,
    ]
  );
  await recordAudit(req, { action: 'plan.update', targetType: 'plan', targetId: id, targetLabel: result.rows[0].name });
  res.json(result.rows[0]);
}

export async function adminDeletePlan(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  // A plan referenced by an enrolment cannot be hard-deleted (FK + history); the
  // admin should deactivate it instead.
  const refs = await query('SELECT 1 FROM enrolments WHERE plan_id = $1 LIMIT 1', [id]);
  if (refs.rows.length > 0) {
    res.status(409).json({
      error: 'This plan has enrolments and cannot be deleted. Deactivate it instead.',
    });
    return;
  }
  const result = await query('DELETE FROM insurance_plans WHERE id = $1 RETURNING id, name', [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }
  await recordAudit(req, { action: 'plan.delete', targetType: 'plan', targetId: id, targetLabel: result.rows[0].name });
  res.json({ deleted: true });
}
