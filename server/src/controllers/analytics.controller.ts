import { Request, Response } from 'express';
import { query } from '../config/database';

// Per-tenant analytics & reporting. Read-only, so it sits behind authenticate
// only (every role, including analysts, can view it). All figures are scoped to
// the caller's organisation.

interface MonthPoint { month: string; members: number; consultations: number; enrolments: number; }

// Build the list of the last `n` months as 'YYYY-MM', oldest first.
function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const months = Math.min(24, Math.max(3, Number(req.query.months) || 6));

  const [
    summary, premium, byPlan, byUnderwriter,
    consultByStatus, consultByMode, triageByLevel, channelBreakdown,
    membersByMonth, consultsByMonth, enrolmentsByMonth,
  ] = await Promise.all([
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM members WHERE org_id = $1) AS members,
         (SELECT COUNT(*)::int FROM members WHERE org_id = $1 AND status = 'active') AS active_members,
         (SELECT COUNT(*)::int FROM consultations WHERE org_id = $1) AS consultations,
         (SELECT COUNT(*)::int FROM consultations WHERE org_id = $1 AND status = 'completed') AS completed_consultations,
         (SELECT COUNT(*)::int FROM enrolments WHERE org_id = $1) AS enrolments,
         (SELECT COUNT(*)::int FROM enrolments WHERE org_id = $1 AND payment_status = 'paid') AS paid_enrolments,
         (SELECT COUNT(*)::int FROM triage_sessions WHERE org_id = $1) AS triage_sessions`,
      [orgId]
    ),
    query(
      `SELECT COALESCE(SUM(pl.monthly_premium), 0) AS premium,
              COALESCE(SUM(pl.monthly_premium * pl.commission_rate / 100), 0) AS commission
       FROM enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id
       WHERE e.org_id = $1 AND e.status = 'active'`,
      [orgId]
    ),
    query(
      `SELECT pl.name AS plan_name, pl.underwriter,
              COUNT(*)::int AS enrolments,
              COALESCE(SUM(pl.monthly_premium), 0) AS premium,
              COALESCE(SUM(pl.monthly_premium * pl.commission_rate / 100), 0) AS commission
       FROM enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id
       WHERE e.org_id = $1 AND e.status = 'active'
       GROUP BY pl.name, pl.underwriter
       ORDER BY premium DESC`,
      [orgId]
    ),
    query(
      `SELECT pl.underwriter,
              COUNT(*)::int AS enrolments,
              COALESCE(SUM(pl.monthly_premium), 0) AS premium
       FROM enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id
       WHERE e.org_id = $1 AND e.status = 'active'
       GROUP BY pl.underwriter
       ORDER BY premium DESC`,
      [orgId]
    ),
    query(`SELECT status, COUNT(*)::int AS count FROM consultations WHERE org_id = $1 GROUP BY status`, [orgId]),
    query(`SELECT mode, COUNT(*)::int AS count FROM consultations WHERE org_id = $1 GROUP BY mode`, [orgId]),
    query(`SELECT triage_level, COUNT(*)::int AS count FROM triage_sessions WHERE org_id = $1 GROUP BY triage_level`, [orgId]),
    query(`SELECT channel, COUNT(*)::int AS count FROM members WHERE org_id = $1 GROUP BY channel`, [orgId]),
    query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM members
       WHERE org_id = $1 AND created_at >= date_trunc('month', NOW()) - make_interval(months => $2)
       GROUP BY 1`,
      [orgId, months - 1]
    ),
    query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM consultations
       WHERE org_id = $1 AND created_at >= date_trunc('month', NOW()) - make_interval(months => $2)
       GROUP BY 1`,
      [orgId, months - 1]
    ),
    query(
      `SELECT to_char(date_trunc('month', enrolled_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM enrolments
       WHERE org_id = $1 AND enrolled_at >= date_trunc('month', NOW()) - make_interval(months => $2)
       GROUP BY 1`,
      [orgId, months - 1]
    ),
  ]);

  // Merge the three monthly series into one zero-filled timeline.
  const mapOf = (rows: { month: string; count: number }[]) =>
    new Map(rows.map((r) => [r.month, r.count]));
  const mMembers = mapOf(membersByMonth.rows);
  const mConsults = mapOf(consultsByMonth.rows);
  const mEnrol = mapOf(enrolmentsByMonth.rows);
  const trend: MonthPoint[] = lastMonths(months).map((month) => ({
    month,
    members: mMembers.get(month) ?? 0,
    consultations: mConsults.get(month) ?? 0,
    enrolments: mEnrol.get(month) ?? 0,
  }));

  const s = summary.rows[0];
  const memberCount = s.members || 0;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  res.json({
    summary: {
      members: s.members,
      activeMembers: s.active_members,
      consultations: s.consultations,
      completedConsultations: s.completed_consultations,
      enrolments: s.enrolments,
      paidEnrolments: s.paid_enrolments,
      triageSessions: s.triage_sessions,
      monthlyPremium: Number(premium.rows[0].premium),
      monthlyCommission: Number(premium.rows[0].commission),
    },
    utilization: {
      // Engagement ratios per member — guard against divide-by-zero.
      consultationsPerMember: memberCount ? round2(s.consultations / memberCount) : 0,
      triagePerMember: memberCount ? round2(s.triage_sessions / memberCount) : 0,
      enrolmentRate: memberCount ? round2(s.enrolments / memberCount) : 0,
      activeRate: memberCount ? round2(s.active_members / memberCount) : 0,
    },
    trend,
    premiumByPlan: byPlan.rows.map((r) => ({
      planName: r.plan_name,
      underwriter: r.underwriter,
      enrolments: r.enrolments,
      premium: Number(r.premium),
      commission: Number(r.commission),
    })),
    byUnderwriter: byUnderwriter.rows.map((r) => ({
      underwriter: r.underwriter,
      enrolments: r.enrolments,
      premium: Number(r.premium),
    })),
    consultationsByStatus: consultByStatus.rows,
    consultationsByMode: consultByMode.rows,
    triageByLevel: triageByLevel.rows,
    channelBreakdown: channelBreakdown.rows,
  });
}
