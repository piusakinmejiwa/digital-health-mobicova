import { query } from '../config/database';

// Single source of truth for plan tiers, their limits, and live usage. Billing,
// usage meters, and limit enforcement all import from here.
//
// Enforcement policy (set with the user):
//   • members  → HARD seat cap (creating past it is blocked).
//   • webhooks / intake → SOFT monthly throughput (warn only; never cut off a
//     live integration mid-month).

export interface Tier {
  key: string;
  name: string;
  price: number | null; // NGN/mo, null = "Custom"
  features: string[];
  limits: { members: number; webhooks: number; intake: number };
}

export const INF = 1_000_000_000;

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

export type LimitKey = 'members' | 'webhooks' | 'intake';
// Which meters block (hard) vs merely warn (soft).
export const HARD_LIMITS: ReadonlySet<LimitKey> = new Set<LimitKey>(['members']);
export const isUnlimited = (limit: number): boolean => limit >= INF;

export function tierFor(key: string | null | undefined): Tier {
  return TIERS.find((t) => t.key === key) || TIERS[0];
}

// The next tier up whose `key` limit is strictly larger — used to suggest an upgrade.
export function nextTierFor(current: Tier, key: LimitKey): Tier | null {
  const idx = TIERS.findIndex((t) => t.key === current.key);
  for (let i = idx + 1; i < TIERS.length; i++) {
    if (TIERS[i].limits[key] > current.limits[key]) return TIERS[i];
  }
  return null;
}

export interface UsageItem {
  key: LimitKey; label: string; used: number; limit: number;
  hard: boolean; unlimited: boolean;
  // Percent used (0–100+, rounded); 0 when unlimited.
  pct: number;
}

// Live usage signals for an org — real counts, never estimates. Shared by the
// billing page and the dashboard usage widget.
// The effective member cap for an org: a per-org override (if set) wins over the
// plan tier's default. Lets platform admins set a bespoke cap (enterprise deals,
// or a low value to exercise the limit/notification flow).
function effectiveMemberLimit(tier: Tier, override: number | null | undefined): number {
  return override == null ? tier.limits.members : Number(override);
}

export async function getUsage(orgId: string): Promise<{ tier: Tier; items: UsageItem[] }> {
  const org = await query('SELECT plan_tier, member_limit_override FROM organisations WHERE id = $1', [orgId]);
  const tier = tierFor(org.rows[0]?.plan_tier);
  const memberLimit = effectiveMemberLimit(tier, org.rows[0]?.member_limit_override);

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

  const build = (key: LimitKey, label: string, used: number): UsageItem => {
    const limit = key === 'members' ? memberLimit : tier.limits[key];
    const unlimited = isUnlimited(limit);
    return {
      key, label, used, limit, hard: HARD_LIMITS.has(key), unlimited,
      pct: unlimited || limit === 0 ? 0 : Math.round((used / limit) * 100),
    };
  };

  return {
    tier,
    items: [
      build('members', 'Members', members.rows[0].n),
      build('webhooks', 'Webhook deliveries (this month)', deliveries.rows[0].n),
      build('intake', 'WhatsApp / USSD intake (this month)', intake.rows[0].n),
    ],
  };
}

export interface SeatCheck {
  used: number;
  limit: number;
  remaining: number;       // seats left (>= 0); Infinity-safe (capped display)
  adding: number;
  exceeded: boolean;       // would this addition push past the cap?
  unlimited: boolean;
  tier: Tier;
  upgradeTo: Tier | null;
}

// Hard seat check for member creation/import. `adding` is how many new members
// the action would create.
export async function checkMemberSeats(orgId: string, adding = 1): Promise<SeatCheck> {
  const org = await query('SELECT plan_tier, member_limit_override FROM organisations WHERE id = $1', [orgId]);
  const tier = tierFor(org.rows[0]?.plan_tier);
  const limit = effectiveMemberLimit(tier, org.rows[0]?.member_limit_override);
  const unlimited = isUnlimited(limit);
  const cur = await query('SELECT COUNT(*)::int AS n FROM members WHERE org_id = $1', [orgId]);
  const used = cur.rows[0].n;
  const remaining = unlimited ? INF : Math.max(0, limit - used);
  const exceeded = !unlimited && used + adding > limit;
  return {
    used, limit, remaining, adding, exceeded, unlimited, tier,
    upgradeTo: exceeded ? nextTierFor(tier, 'members') : null,
  };
}

// Standard structured payload returned (HTTP 403) when a hard seat cap blocks a
// write — the client uses `code` to show an upgrade prompt.
export function seatLimitError(check: SeatCheck, adding: number) {
  const plan = check.tier.name;
  const upgrade = check.upgradeTo ? ` Upgrade to ${check.upgradeTo.name} for ${check.upgradeTo.limits.members.toLocaleString()} members.` : '';
  const detail = adding > 1
    ? `This import adds ${adding} members but only ${check.remaining} seat(s) remain on your ${plan} plan.${upgrade}`
    : `You've reached your ${plan} plan limit of ${check.limit.toLocaleString()} members.${upgrade}`;
  return {
    error: detail,
    code: 'member_limit_reached',
    limit: check.limit,
    used: check.used,
    remaining: check.remaining,
    upgradeTo: check.upgradeTo?.key ?? null,
  };
}
