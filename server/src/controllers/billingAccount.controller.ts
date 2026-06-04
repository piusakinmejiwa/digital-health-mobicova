import { Request, Response } from 'express';
import { query } from '../config/database';
import { recordAudit } from '../lib/audit';

// Demo-grade billing. Plan tiers and limits are defined here; usage meters are
// REAL counts from the org's data; invoices are representative samples (no real
// invoicing engine yet). Changing plan switches the org's tier directly — a real
// deployment would route this through Paystack/Stripe checkout.

interface Tier {
  key: string;
  name: string;
  price: number | null; // NGN/mo, null = "Custom"
  features: string[];
  limits: { members: number; webhooks: number; intake: number };
}

const INF = 1_000_000_000;

export const TIERS: Tier[] = [
  {
    key: 'starter', name: 'Starter', price: 60000,
    features: ['Up to 1,000 members', 'Telemedicine & AI triage', 'WhatsApp & USSD intake', 'Email support'],
    limits: { members: 1000, webhooks: 5000, intake: 2000 },
  },
  {
    key: 'growth', name: 'Growth', price: 180000,
    features: ['Up to 10,000 members', 'Claims workflow', 'Public API & webhooks', 'Analytics & reporting', 'Priority support'],
    limits: { members: 10000, webhooks: 50000, intake: 20000 },
  },
  {
    key: 'scale', name: 'Scale', price: 340000,
    features: ['Up to 50,000 members', 'White-label branding', 'SAML single sign-on', 'Custom domain', 'Dedicated success manager'],
    limits: { members: 50000, webhooks: 250000, intake: 100000 },
  },
  {
    key: 'enterprise', name: 'Enterprise', price: null,
    features: ['Unlimited members', 'Custom integrations', 'Bespoke SLAs', 'On-prem / VPC options', '24/7 support'],
    limits: { members: INF, webhooks: INF, intake: INF },
  },
];

function tierFor(key: string): Tier {
  return TIERS.find((t) => t.key === key) || TIERS[0];
}

// GET /billing — plan, usage vs limits, sample invoices.
export async function getBillingAccount(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;

  const org = await query('SELECT name, plan_tier, created_at FROM organisations WHERE id = $1', [orgId]);
  const planKey = org.rows[0]?.plan_tier || 'starter';
  const tier = tierFor(planKey);

  // Real usage signals.
  const [members, deliveries, intake] = await Promise.all([
    query('SELECT COUNT(*)::int AS n FROM members WHERE org_id = $1', [orgId]),
    query(
      `SELECT COUNT(*)::int AS n FROM webhook_deliveries d
       JOIN webhook_endpoints w ON d.endpoint_id = w.id
       WHERE w.org_id = $1 AND d.created_at >= date_trunc('month', NOW())`,
      [orgId]
    ),
    query(
      `SELECT COUNT(*)::int AS n FROM intake_sessions
       WHERE org_id = $1 AND created_at >= date_trunc('month', NOW())`,
      [orgId]
    ),
  ]);

  const usage = [
    { key: 'members', label: 'Members', used: members.rows[0].n, limit: tier.limits.members },
    { key: 'webhooks', label: 'Webhook deliveries (this month)', used: deliveries.rows[0].n, limit: tier.limits.webhooks },
    { key: 'intake', label: 'WhatsApp / USSD intake (this month)', used: intake.rows[0].n, limit: tier.limits.intake },
  ];

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
