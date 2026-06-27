import { Request, Response } from 'express';
import { query } from '../config/database';
import { tierFor } from '../lib/plans';

// Customer-success surface: a composite "account health" score from real usage
// signals, with plain-language recommendations and a tier-aware success contact.

const MANAGER_EMAIL = 'success@mobicova.com';
const SUPPORT_EMAIL = 'support@mobicova.com';

interface Factor { key: string; label: string; value: number; weight: number; }

export async function getAccountHealth(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;

  const [org, counts] = await Promise.all([
    query('SELECT plan_tier FROM organisations WHERE id = $1', [orgId]),
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM members WHERE org_id = $1) AS members,
         (SELECT COUNT(*)::int FROM members WHERE org_id = $1 AND status = 'active') AS active_members,
         (SELECT COUNT(*)::int FROM consultations WHERE org_id = $1 AND created_at >= NOW() - INTERVAL '30 days') AS consults_30d,
         (SELECT COUNT(*)::int FROM enrolments WHERE org_id = $1) AS enrolments,
         (SELECT COUNT(*)::int FROM enrolments WHERE org_id = $1 AND payment_status = 'paid') AS paid_enrolments`,
      [orgId]
    ),
  ]);
  const c = counts.rows[0];
  const tier = tierFor(org.rows[0]?.plan_tier);
  const clamp = (n: number) => Math.max(0, Math.min(1, n));

  // Each factor is 0–1; the score is their weighted average × 100.
  const factors: Factor[] = [
    { key: 'adoption', label: 'Member adoption', weight: 0.25, value: clamp(c.members / 50) },
    { key: 'activation', label: 'Active members', weight: 0.30, value: c.members ? clamp(c.active_members / c.members) : 0 },
    { key: 'engagement', label: 'Telemedicine engagement', weight: 0.25, value: clamp(c.consults_30d / Math.max(1, c.members * 0.1)) },
    { key: 'monetisation', label: 'Premiums collected', weight: 0.20, value: c.enrolments ? clamp(c.paid_enrolments / c.enrolments) : 0 },
  ];
  const score = Math.round(factors.reduce((s, f) => s + f.value * f.weight, 0) * 100);
  const band = score >= 75 ? 'Excellent' : score >= 50 ? 'Good' : score >= 25 ? 'Fair' : 'Needs attention';

  // Recommendations from the weakest factors (most impactful first).
  const tips: string[] = [];
  if (c.members < 50) tips.push('Import your member list to get the most from the platform.');
  if (c.members && c.active_members / c.members < 0.6) tips.push('Re-engage inactive members — a Daily Health Tip or reminder helps.');
  if (c.consults_30d === 0) tips.push('Promote telemedicine to members — virtual consults drive value and savings.');
  if (c.enrolments && c.paid_enrolments / c.enrolments < 0.7) tips.push('Follow up on unpaid premiums in the Insurance workspace.');
  if (tips.length === 0) tips.push('You’re in great shape — keep members engaged and consider a scheduled report for stakeholders.');

  const dedicated = tier.key === 'scale' || tier.key === 'enterprise';
  res.json({
    score,
    band,
    factors: factors.map((f) => ({ key: f.key, label: f.label, pct: Math.round(f.value * 100) })),
    recommendations: tips.slice(0, 3),
    contact: dedicated
      ? { kind: 'manager', label: 'Your dedicated success manager', email: MANAGER_EMAIL }
      : { kind: 'support', label: 'MobiCova support', email: SUPPORT_EMAIL },
    planName: tier.name,
  });
}
