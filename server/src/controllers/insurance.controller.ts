import { Request, Response } from 'express';
import { query } from '../config/database';
import { stripe, stripeEnabled } from '../config/stripe';
import { env } from '../config/env';

export async function listPlans(_req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT * FROM insurance_plans WHERE is_active = true ORDER BY monthly_premium`
  );
  res.json(result.rows);
}

export async function listEnrolments(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const result = await query(
    `SELECT e.*, m.full_name AS member_name,
            pl.name AS plan_name, pl.plan_type, pl.monthly_premium, pl.currency, pl.underwriter, pl.commission_rate
     FROM enrolments e
     JOIN members m ON e.member_id = m.id
     JOIN insurance_plans pl ON e.plan_id = pl.id
     WHERE e.org_id = $1 ORDER BY e.enrolled_at DESC`,
    [orgId]
  );
  res.json(result.rows);
}

export async function enrolMember(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { memberId, planId } = req.body;

  const member = await query(`SELECT id FROM members WHERE id = $1 AND org_id = $2`, [memberId, orgId]);
  if (member.rows.length === 0) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  const plan = await query(`SELECT id FROM insurance_plans WHERE id = $1 AND is_active = true`, [planId]);
  if (plan.rows.length === 0) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }

  const result = await query(
    `INSERT INTO enrolments (org_id, member_id, plan_id, status, payment_status)
     VALUES ($1, $2, $3, 'active', 'unpaid') RETURNING *`,
    [orgId, memberId, planId]
  );
  res.status(201).json(result.rows[0]);
}

// Creates a Stripe Checkout session for a premium payment, when Stripe is configured.
export async function createPremiumCheckout(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;

  const enrolment = await query(
    `SELECT e.id, pl.name AS plan_name, pl.monthly_premium, pl.currency
     FROM enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id
     WHERE e.id = $1 AND e.org_id = $2`,
    [id, orgId]
  );
  if (enrolment.rows.length === 0) {
    res.status(404).json({ error: 'Enrolment not found' });
    return;
  }

  if (!stripeEnabled || !stripe) {
    // Graceful demo path: mark as paid without a real payment.
    await query(`UPDATE enrolments SET payment_status = 'paid' WHERE id = $1`, [id]);
    res.json({ stripeEnabled: false, message: 'Stripe not configured — premium marked paid (demo mode).' });
    return;
  }

  const plan = enrolment.rows[0];
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: (plan.currency || 'NGN').toLowerCase(),
          product_data: { name: `${plan.plan_name} — monthly premium` },
          unit_amount: Math.round(Number(plan.monthly_premium) * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${env.clientUrl}/insurance?payment=success`,
    cancel_url: `${env.clientUrl}/insurance?payment=cancelled`,
    metadata: { enrolmentId: String(id) },
  });

  await query(`UPDATE enrolments SET stripe_session_id = $2 WHERE id = $1`, [id, session.id]);
  res.json({ stripeEnabled: true, url: session.url });
}
