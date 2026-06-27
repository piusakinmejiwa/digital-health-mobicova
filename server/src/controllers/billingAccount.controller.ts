import { Request, Response } from 'express';
import { query } from '../config/database';
import { recordAudit } from '../lib/audit';
import { TIERS, tierFor, getUsage } from '../lib/plans';

// Demo-grade billing. Plan tiers/limits live in lib/plans.ts (shared with the
// usage meters + limit enforcement); usage figures are REAL counts from the
// org's data; invoices are representative samples (no real invoicing engine
// yet). Changing plan switches the org's tier directly — a real deployment would
// route this through Paystack/Stripe checkout.

// GET /billing — plan, usage vs limits, sample invoices.
export async function getBillingAccount(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;

  const org = await query('SELECT name, plan_tier, created_at FROM organisations WHERE id = $1', [orgId]);

  // Live usage vs limits (shared engine).
  const { tier, items } = await getUsage(orgId);
  const usage = items.map((i) => ({ key: i.key, label: i.label, used: i.used, limit: i.limit }));

  // Next tier up (for the upsell card).
  const idx = TIERS.findIndex((t) => t.key === tier.key);
  const recommended = idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;

  // Renewal = first of next month.
  const now = new Date();
  const renewsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

  // Representative invoices for the last few months at the current price.
  const invoices = [];
  if (tier.price) {
    for (let i = 1; i <= 3; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      const ym = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      invoices.push({
        reference: `INV-${ym}`,
        date: d.toISOString(),
        plan: tier.name,
        amount: tier.price,
        status: 'paid',
      });
    }
  }

  res.json({
    plan: { key: tier.key, name: tier.name, price: tier.price },
    renewsAt,
    paymentMethod: 'Paystack ···· 4242',
    billingCurrency: 'NGN',
    usage,
    tiers: TIERS,
    recommendedTier: recommended,
    invoices,
  });
}

// GET /billing/usage — lightweight live usage vs limits (no invoices). Used by
// the dashboard usage widget and the member create/import "seats remaining" hints.
export async function getOrgUsage(req: Request, res: Response): Promise<void> {
  const { tier, items } = await getUsage(req.user!.orgId);
  res.json({ plan: { key: tier.key, name: tier.name }, usage: items });
}

// POST /billing/plan { tier } — switch plan (admin). Demo: sets the tier directly.
export async function changePlan(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const tierKey = String(req.body?.tier || '');
  if (!TIERS.some((t) => t.key === tierKey)) {
    res.status(400).json({ error: 'Unknown plan tier.' });
    return;
  }
  await query('UPDATE organisations SET plan_tier = $1 WHERE id = $2', [tierKey, orgId]);
  await recordAudit(req, {
    action: 'billing.plan_change', targetType: 'organisation', targetId: orgId,
    orgId, metadata: { tier: tierKey },
  });
  res.json({ plan: { key: tierKey, name: tierFor(tierKey).name } });
}
