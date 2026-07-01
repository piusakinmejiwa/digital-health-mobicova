import { Request, Response } from 'express';
import { pool, query } from '../config/database';
import { newMembershipId } from '../lib/membership';
import { productView, quotePremium, emitPartnerEvent, PlanRow } from '../lib/distribution';

// The Partner Distribution API (/api/partner/v1). Every handler runs behind
// authenticateDistributionPartner, so req.distributionPartner is set: the partner
// and the underwriter org whose plans they sell. All reads/writes are scoped to
// that org, and to plans underwritten by it.

function partnerOrg(req: Request) { return req.distributionPartner!; }

async function orgName(orgId: string): Promise<string> {
  const r = await query('SELECT name FROM organisations WHERE id = $1', [orgId]);
  return r.rows[0]?.name || '';
}

// A plan is sellable by a partner when it's active AND underwritten by the
// partner's org (underwriter matches the org name).
async function findSellablePlan(orgId: string, planId: string): Promise<PlanRow | null> {
  const name = await orgName(orgId);
  const r = await query(
    `SELECT id, name, plan_type, monthly_premium, currency, cover_amount, benefits, description
       FROM insurance_plans WHERE id = $1 AND is_active = true AND underwriter = $2`,
    [planId, name]
  );
  return r.rows[0] || null;
}

function coverStatus(status: string): string {
  if (status === 'active') return 'active';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'expired') return 'expired';
  return 'pending_payment';
}

// GET /products — the underwriter's plans this partner may distribute.
export async function listProducts(req: Request, res: Response): Promise<void> {
  const name = await orgName(partnerOrg(req).orgId);
  const r = await query(
    `SELECT id, name, plan_type, monthly_premium, currency, cover_amount, benefits, description
       FROM insurance_plans WHERE is_active = true AND underwriter = $1 ORDER BY monthly_premium ASC`,
    [name]
  );
  res.json({ products: r.rows.map(productView) });
}

// POST /quote { planId, dependants? } — price a plan for a prospective member.
export async function quote(req: Request, res: Response): Promise<void> {
  const planId = String(req.body?.planId || '');
  const plan = await findSellablePlan(partnerOrg(req).orgId, planId);
  if (!plan) { res.status(404).json({ error: 'Plan not found or not available for distribution' }); return; }
  const q = quotePremium(plan);
  res.json({
    planId: plan.id,
    planName: plan.name,
    currency: q.currency,
    monthlyPremium: q.monthlyPremium,
    coverAmount: Number(plan.cover_amount),
    billingCycle: 'monthly',
  });
}

// POST /enrolments — bind a policy: create the member + a pending enrolment. The
// member becomes reachable in MobiCova (telemedicine / claims / USSD) once the
// premium is confirmed via the payment endpoint. Idempotent on externalRef.
export async function createEnrolment(req: Request, res: Response): Promise<void> {
  const p = partnerOrg(req);
  const b = req.body || {};
  const planId = String(b.planId || '');
  const externalRef = String(b.externalRef || '').trim();
  const m = b.member || {};
  const fullName = String(m.fullName || '').trim();

  if (!fullName) { res.status(400).json({ error: 'member.fullName is required' }); return; }
  if (!m.email && !m.phone) { res.status(400).json({ error: 'member.email or member.phone is required' }); return; }

  const plan = await findSellablePlan(p.orgId, planId);
  if (!plan) { res.status(404).json({ error: 'Plan not found or not available for distribution' }); return; }

  // Idempotency: a repeated order ref returns the existing policy, not a duplicate.
  if (externalRef) {
    const existing = await query(
      `SELECT e.id, e.status, e.premium_amount, e.currency, e.external_ref, e.sandbox,
              mem.membership_id, mem.full_name
         FROM enrolments e JOIN members mem ON mem.id = e.member_id
        WHERE e.source_partner_id = $1 AND e.external_ref = $2`,
      [p.id, externalRef]
    );
    if (existing.rows.length > 0) {
      const e = existing.rows[0];
      res.status(200).json({
        enrolmentId: e.id, membershipId: e.membership_id, externalRef: e.external_ref,
        status: coverStatus(e.status), premium: Number(e.premium_amount), currency: e.currency,
        plan: { planId: plan.id, name: plan.name }, sandbox: e.sandbox, idempotent: true,
      });
      return;
    }
  }

  const premium = quotePremium(plan).monthlyPremium;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const membershipId = await newMembershipId(p.orgId);
    const memRes = await client.query(
      `INSERT INTO members (org_id, full_name, phone, email, gender, date_of_birth, channel, status, membership_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'web', 'active', $7)
       RETURNING id, membership_id, full_name, phone, email`,
      [p.orgId, fullName, String(m.phone || ''), String(m.email || ''),
       String(m.gender || ''), m.dateOfBirth || null, membershipId]
    );
    const member = memRes.rows[0];
    const enrRes = await client.query(
      `INSERT INTO enrolments (org_id, member_id, plan_id, status, payment_status,
                               source_partner_id, external_ref, premium_amount, currency, sandbox)
       VALUES ($1, $2, $3, 'pending', 'unpaid', $4, $5, $6, $7, $8)
       RETURNING id`,
      [p.orgId, member.id, plan.id, p.id, externalRef || null, premium, plan.currency || 'NGN', p.sandbox]
    );
    await client.query('COMMIT');
    res.status(201).json({
      enrolmentId: enrRes.rows[0].id,
      membershipId: member.membership_id,
      externalRef: externalRef || null,
      status: 'pending_payment',
      premium, currency: plan.currency || 'NGN',
      member: { fullName: member.full_name, phone: member.phone || null, email: member.email || null },
      plan: { planId: plan.id, name: plan.name },
      sandbox: p.sandbox,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// POST /enrolments/:id/payment — the partner confirms premium collected. Activates
// the policy (idempotent) and fires the policy.activated webhook back to the partner.
export async function recordPayment(req: Request, res: Response): Promise<void> {
  const p = partnerOrg(req);
  const id = String(req.params.id);
  const cur = await query(
    'SELECT id, status FROM enrolments WHERE id = $1 AND source_partner_id = $2',
    [id, p.id]
  );
  if (cur.rows.length === 0) { res.status(404).json({ error: 'Enrolment not found' }); return; }

  if (cur.rows[0].status !== 'active') {
    await query(
      `UPDATE enrolments SET status = 'active', payment_status = 'paid',
              paid_at = NOW(), activated_at = NOW() WHERE id = $1`,
      [id]
    );
    emitPartnerEvent(
      { id: p.id, webhook_url: p.webhookUrl, webhook_secret: p.webhookSecret },
      'policy.activated',
      { enrolmentId: id }
    );
  }
  res.json({ enrolmentId: id, status: 'active' });
}

// GET /enrolments/:id — policy + cover status for the partner's "my insurance" view.
export async function getEnrolment(req: Request, res: Response): Promise<void> {
  const p = partnerOrg(req);
  const id = String(req.params.id);
  const r = await query(
    `SELECT e.id, e.status, e.premium_amount, e.currency, e.external_ref, e.sandbox,
            e.enrolled_at, e.activated_at,
            mem.membership_id, mem.full_name, mem.phone, mem.email,
            pl.id AS plan_id, pl.name AS plan_name, pl.cover_amount
       FROM enrolments e
       JOIN members mem ON mem.id = e.member_id
       JOIN insurance_plans pl ON pl.id = e.plan_id
      WHERE e.id = $1 AND e.source_partner_id = $2`,
    [id, p.id]
  );
  if (r.rows.length === 0) { res.status(404).json({ error: 'Enrolment not found' }); return; }
  const e = r.rows[0];
  res.json({
    enrolmentId: e.id, membershipId: e.membership_id, externalRef: e.external_ref,
    status: coverStatus(e.status), premium: Number(e.premium_amount), currency: e.currency,
    enrolledAt: e.enrolled_at, activatedAt: e.activated_at, sandbox: e.sandbox,
    member: { fullName: e.full_name, phone: e.phone || null, email: e.email || null },
    plan: { planId: e.plan_id, name: e.plan_name, coverAmount: Number(e.cover_amount) },
  });
}

// POST /enrolments/:id/cancel — cancel/lapse a policy.
export async function cancelEnrolment(req: Request, res: Response): Promise<void> {
  const p = partnerOrg(req);
  const id = String(req.params.id);
  const r = await query(
    `UPDATE enrolments SET status = 'cancelled', payment_status = 'cancelled'
      WHERE id = $1 AND source_partner_id = $2 AND status <> 'cancelled' RETURNING id`,
    [id, p.id]
  );
  if (r.rows.length === 0) {
    const exists = await query('SELECT status FROM enrolments WHERE id = $1 AND source_partner_id = $2', [id, p.id]);
    if (exists.rows.length === 0) { res.status(404).json({ error: 'Enrolment not found' }); return; }
  } else {
    emitPartnerEvent(
      { id: p.id, webhook_url: p.webhookUrl, webhook_secret: p.webhookSecret },
      'policy.cancelled',
      { enrolmentId: id }
    );
  }
  res.json({ enrolmentId: id, status: 'cancelled' });
}
