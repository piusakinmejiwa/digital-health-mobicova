import { Request, Response } from 'express';
import { query } from '../config/database';

export async function getDashboard(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;

  const [members, consultations, enrolments, triage, premium, recentConsults, recentEnrolments, channelBreakdown] =
    await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM members WHERE org_id = $1`, [orgId]),
      query(`SELECT COUNT(*)::int AS count FROM consultations WHERE org_id = $1`, [orgId]),
      query(`SELECT COUNT(*)::int AS count FROM enrolments WHERE org_id = $1`, [orgId]),
      query(`SELECT COUNT(*)::int AS count FROM triage_sessions WHERE org_id = $1`, [orgId]),
      query(
        `SELECT COALESCE(SUM(pl.monthly_premium), 0) AS total,
                COALESCE(SUM(pl.monthly_premium * pl.commission_rate / 100), 0) AS commission
         FROM enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id
         WHERE e.org_id = $1 AND e.status = 'active'`,
        [orgId]
      ),
      query(
        `SELECT c.id, c.status, c.mode, c.created_at, m.full_name AS member_name
         FROM consultations c JOIN members m ON c.member_id = m.id
         WHERE c.org_id = $1 ORDER BY c.created_at DESC LIMIT 5`,
        [orgId]
      ),
      query(
        `SELECT e.id, e.status, e.payment_status, e.enrolled_at,
                m.full_name AS member_name, pl.name AS plan_name
         FROM enrolments e JOIN members m ON e.member_id = m.id
         JOIN insurance_plans pl ON e.plan_id = pl.id
         WHERE e.org_id = $1 ORDER BY e.enrolled_at DESC LIMIT 5`,
        [orgId]
      ),
      query(
        `SELECT channel, COUNT(*)::int AS count FROM members WHERE org_id = $1 GROUP BY channel`,
        [orgId]
      ),
    ]);

  const triageBreakdown = await query(
    `SELECT triage_level, COUNT(*)::int AS count
     FROM triage_sessions WHERE org_id = $1 GROUP BY triage_level`,
    [orgId]
  );

  const memberCount = members.rows[0].count;

  res.json({
    metrics: {
      members: memberCount,
      consultations: consultations.rows[0].count,
      enrolments: enrolments.rows[0].count,
      triageSessions: triage.rows[0].count,
      monthlyPremium: Number(premium.rows[0].total),
      monthlyCommission: Number(premium.rows[0].commission),
    },
    milestones: {
      // Entry-strategy milestones from the strategic briefing.
      target10k: { label: '10,000 active health users', current: memberCount, target: 10000 },
      target100k: { label: '100,000 health users', current: memberCount, target: 100000 },
    },
    channelBreakdown: channelBreakdown.rows,
    triageBreakdown: triageBreakdown.rows,
    recentConsultations: recentConsults.rows,
    recentEnrolments: recentEnrolments.rows,
  });
}
