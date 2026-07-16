import { Request, Response } from 'express';
import { query } from '../config/database';
import { getAiActivity } from '../lib/aiActivity';
import { resolveOrgActor, memberVisibilityClause, coverageChainClause } from '../lib/orgHierarchy';
import { EFFECTIVE_PREMIUM, planAssignmentJoin } from '../lib/premium';

export async function getDashboard(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;

  // Coverage-chain scopes: an HMO/insurer's headline numbers span its whole book
  // (members on the plans it offers/underwrites); a company's are its own, as before.
  const actor = await resolveOrgActor(orgId);
  const mScope = memberVisibilityClause(actor, 'm', 1);                                   // members (m.id)
  const cScope = coverageChainClause(actor, { alias: 'c', memberCol: 'member_id' });      // consultations
  const eScope = coverageChainClause(actor, { alias: 'e', memberCol: 'member_id' });      // enrolments
  const tScope = coverageChainClause(actor, { alias: 't', memberCol: 'member_id' });      // triage

  const [members, consultations, enrolments, triage, premium, recentConsults, recentEnrolments, channelBreakdown] =
    await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM members m WHERE ${mScope.sql}`, mScope.params),
      query(`SELECT COUNT(*)::int AS count FROM consultations c WHERE ${cScope.sql}`, cScope.params),
      query(`SELECT COUNT(*)::int AS count FROM enrolments e WHERE ${eScope.sql}`, eScope.params),
      query(`SELECT COUNT(*)::int AS count FROM triage_sessions t WHERE ${tScope.sql}`, tScope.params),
      query(
        `SELECT COALESCE(SUM(${EFFECTIVE_PREMIUM}), 0) AS total,
                COALESCE(SUM(${EFFECTIVE_PREMIUM} * pl.commission_rate / 100), 0) AS commission
         FROM enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id
         ${planAssignmentJoin('e')}
         WHERE ${eScope.sql} AND e.status = 'active'`,
        eScope.params
      ),
      query(
        `SELECT c.id, c.status, c.mode, c.created_at, m.full_name AS member_name
         FROM consultations c JOIN members m ON c.member_id = m.id
         WHERE ${cScope.sql} ORDER BY c.created_at DESC LIMIT 5`,
        cScope.params
      ),
      query(
        `SELECT e.id, e.status, e.payment_status, e.enrolled_at,
                m.full_name AS member_name, pl.name AS plan_name
         FROM enrolments e JOIN members m ON e.member_id = m.id
         JOIN insurance_plans pl ON e.plan_id = pl.id
         WHERE ${eScope.sql} ORDER BY e.enrolled_at DESC LIMIT 5`,
        eScope.params
      ),
      query(
        `SELECT channel, COUNT(*)::int AS count FROM members m WHERE ${mScope.sql} GROUP BY channel`,
        mScope.params
      ),
    ]);

  const triageBreakdown = await query(
    `SELECT triage_level, COUNT(*)::int AS count
     FROM triage_sessions t WHERE ${tScope.sql} GROUP BY triage_level`,
    tScope.params
  );

  const memberCount = members.rows[0].count;

  // --- Onboarding progress (derived from real signals, never stored booleans) ---
  const [org, userCount, webhookCount, me] = await Promise.all([
    query(`SELECT name, join_code FROM organisations WHERE id = $1`, [orgId]),
    query(`SELECT COUNT(*)::int AS count FROM users WHERE org_id = $1`, [orgId]),
    query(`SELECT COUNT(*)::int AS count FROM webhook_endpoints WHERE org_id = $1 AND active = true`, [orgId]),
    query(`SELECT onboarding_dismissed FROM users WHERE id = $1`, [req.user!.userId]),
  ]);

  const enrolmentCount = enrolments.rows[0].count;
  const orgName = org.rows[0]?.name || 'your organisation';
  const joinCode = org.rows[0]?.join_code || '';

  // Each step's `done` comes from a live count. The first not-done step is "active".
  const steps = [
    {
      key: 'verify_org', title: 'Verify your organisation',
      sub: `${orgName} · join code ${joinCode}`, done: true,
      kicker: 'Step 1 of 6', detailTitle: 'Your organisation is live',
      body: 'Your workspace is set up and your join code is active. Members who enrol over WhatsApp or USSD with this code are attributed to you.',
      cta: 'View join code', ctaHref: '/channels',
      perks: ['Workspace ready', '6-digit join code active', 'Attribution wired across every channel'],
    },
    {
      key: 'join_code', title: 'Set your join code & channels',
      sub: 'WhatsApp & USSD intake ready to go', done: !!joinCode,
      kicker: 'Step 2 of 6', detailTitle: 'Channels are ready',
      body: 'Test the WhatsApp and USSD enrolment flows with the in-app simulators — no telco account needed.',
      cta: 'Open WhatsApp & USSD', ctaHref: '/channels',
      perks: ['In-app simulators', 'No telco account needed', 'Stateless USSD + stateful WhatsApp'],
    },
    {
      key: 'add_members', title: 'Add members or import a CSV',
      sub: 'Onboard a roster, or enrol over WhatsApp & USSD', done: memberCount > 0,
      kicker: 'Step 3 of 6', detailTitle: 'Bring your members in',
      body: 'Add members one at a time, bulk-import a spreadsheet of policyholders, or let members self-enrol over WhatsApp & USSD with your join code.',
      cta: 'Import CSV', ctaHref: '/members',
      perks: ['Up to 1,000 rows per import', 'Flexible column matching', 'Per-row error report'],
    },
    {
      key: 'first_enrolment', title: 'Enrol a member in a plan',
      sub: 'Members enrol into cover over any channel', done: enrolmentCount > 0,
      kicker: 'Step 4 of 6', detailTitle: 'Enrol your first member',
      body: 'A plan is the cover members enrol into. Enrol a member to start tracking premium and commission — and to unlock claims.',
      cta: 'Go to Insurance', ctaHref: '/insurance',
      perks: ['Premium & commission tracking', 'Paystack / Stripe checkout', 'Unlocks the claims workflow'],
    },
    {
      key: 'invite_team', title: 'Invite a teammate',
      sub: 'Add admins, managers or analysts', done: userCount.rows[0].count >= 2,
      kicker: 'Step 5 of 6', detailTitle: 'Bring your team on',
      body: 'Add colleagues with the right role — admins manage everything, managers handle members and services, analysts get read-only access.',
      cta: 'Open Admin Console', ctaHref: '/admin',
      perks: ['Per-tenant roles', 'Read-only analyst access', 'Server-enforced permissions'],
    },
    {
      key: 'connect_webhook', title: 'Connect a webhook',
      sub: 'Stream enrolments & claims to your core system', done: webhookCount.rows[0].count > 0,
      kicker: 'Step 6 of 6', detailTitle: 'Wire up your systems',
      body: 'Register an endpoint and subscribe to events like member.enrolled and claim.status_changed. Payloads are signed with HMAC-SHA256.',
      cta: 'Open API & webhooks', ctaHref: '/settings/developer',
      perks: ['Signed, verifiable payloads', 'Delivery log', 'Test ping button'],
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  const activeIndex = steps.findIndex((s) => !s.done);

  const aiActivity = await getAiActivity(orgId, 7);

  res.json({
    aiActivity,
    onboarding: {
      dismissed: me.rows[0]?.onboarding_dismissed ?? false,
      completed,
      total: steps.length,
      activeIndex: activeIndex === -1 ? steps.length - 1 : activeIndex,
      allDone: completed === steps.length,
      steps,
    },
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

// POST /dashboard/onboarding/dismiss — persist the per-user "hide setup" choice.
export async function dismissOnboarding(req: Request, res: Response): Promise<void> {
  const dismissed = req.body?.dismissed !== false; // default true
  await query('UPDATE users SET onboarding_dismissed = $1 WHERE id = $2', [dismissed, req.user!.userId]);
  res.json({ dismissed });
}
