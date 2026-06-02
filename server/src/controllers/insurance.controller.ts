import { Request, Response } from 'express';
import { query } from '../config/database';
import { stripe, stripeEnabled } from '../config/stripe';
import { paystackEnabled, paystackInitialize } from '../config/paystack';
import { env } from '../config/env';
import { emitEvent } from '../lib/webhooks';

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
  const enrolment = result.rows[0];

  // Notify any subscribed partner systems.
  emitEvent(orgId, 'member.enrolled', {
    enrolment_id: enrolment.id,
    member_id: enrolment.member_id,
    plan_id: enrolment.plan_id,
    status: enrolment.status,
    payment_status: enrolment.payment_status,
    enrolled_at: enrolment.enrolled_at,
  });

  res.status(201).json(enrolment);
}

// Starts a premium payment. Prefers Paystack (NGN-native, the production choice
// for Nigeria), falls back to Stripe, then to a demo path that simply marks the
// premium paid when no processor is configured. The hosted-checkout URL is
// returned for the browser to redirect to; payment is only confirmed later by
// the provider's webhook (see billing.controller), never by the redirect itself.
export async function createPremiumCheckout(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;

  const enrolment = await query(
    `SELECT e.id, m.email AS member_email, m.full_name AS member_name,
            pl.name AS plan_name, pl.monthly_premium, pl.currency
     FROM enrolments e
     JOIN insurance_plans pl ON e.plan_id = pl.id
     JOIN members m ON e.member_id = m.id
     WHERE e.id = $1 AND e.org_id = $2`,
    [id, orgId]
  );
  if (enrolment.rows.length === 0) {
    res.status(404).json({ error: 'Enrolment not found' });
    return;
  }

  const plan = enrolment.rows[0];
  const amountMinor = Math.round(Number(plan.monthly_premium) * 100);
  const currency = (plan.currency || 'NGN').toUpperCase();

  // Paystack — preferred for NGN.
  if (paystackEnabled) {
    const email = plan.member_email && String(plan.member_email).includes('@')
      ? plan.member_email
      : `member-${id}@mobicova.health`;
    const init = await paystackInitialize({
      email,
      amount: amountMinor,
      currency,
      callback_url: `${env.clientUrl}/insurance?payment=success`,
      metadata: { enrolmentId: String(id) },
    });
    await query(
      `UPDATE enrolments SET payment_provider = 'paystack', payment_reference = $2 WHERE id = $1`,
      [id, init.data.reference]
    );
    res.json({ provider: 'paystack', url: init.data.authorization_url });
    return;
  }

  // Stripe — fallback (note: does not support NGN in all accounts).
  if (stripeEnabled && stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: `${plan.plan_name} — monthly premium` },
            unit_amount: amountMinor,
          },
          quantity: 1,
        },
      ],
      success_url: `${env.clientUrl}/insurance?payment=success`,
      cancel_url: `${env.clientUrl}/insurance?payment=cancelled`,
      metadata: { enrolmentId: String(id) },
    });
    await query(
      `UPDATE enrolments SET payment_provider = 'stripe', stripe_session_id = $2, payment_reference = $2 WHERE id = $1`,
      [id, session.id]
    );
    res.json({ provider: 'stripe', url: session.url });
    return;
  }

  // Demo path: no processor configured, mark as paid without a real payment.
  await query(
    `UPDATE enrolments SET payment_status = 'paid', payment_provider = 'demo' WHERE id = $1`,
    [id]
  );
  res.json({ provider: 'demo', message: 'No payment provider configured — premium marked paid (demo mode).' });
}
