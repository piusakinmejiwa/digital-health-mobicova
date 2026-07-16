import { query } from '../config/database';
import type { OrgBranding } from './branding';
import { resolveOrgActor, memberVisibilityClause, coverageChainClause } from './orgHierarchy';

// Scheduled client reports. Three cadences, each reporting the most-recently
// *completed* period relative to "now":
//   daily   → yesterday
//   weekly  → last ISO week (Mon–Sun)
//   monthly → last calendar month
// All windows are half-open [start, end) in UTC. The same engine powers the
// cron sends, the admin "send now"/preview, and the in-app report archive.

export type Cadence = 'daily' | 'weekly' | 'monthly';
export const CADENCES: Cadence[] = ['daily', 'weekly', 'monthly'];
export function isCadence(v: unknown): v is Cadence {
  return v === 'daily' || v === 'weekly' || v === 'monthly';
}

export interface Period {
  cadence: Cadence;
  key: string;        // idempotency key: 2026-06-26 | 2026-W26 | 2026-06
  start: Date;        // inclusive
  end: Date;          // exclusive
  label: string;      // human label of the period covered
  prevStart: Date;    // equal-length preceding window, for deltas
  prevEnd: Date;
}

const DAY = 86_400_000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function longDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
// ISO-8601 week number + year (the year the week belongs to may differ at boundaries).
function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;          // 0=Mon..6=Sun
  t.setUTCDate(t.getUTCDate() - dayNum + 3);       // nearest Thursday
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNum + 3);
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * DAY));
  return { year: t.getUTCFullYear(), week };
}

export function periodFor(cadence: Cadence, now: Date): Period {
  if (cadence === 'daily') {
    const end = startOfUTCDay(now);                  // today 00:00 ⇒ covers yesterday
    const start = new Date(end.getTime() - DAY);
    return { cadence, key: ymd(start), start, end, label: longDate(start),
      prevStart: new Date(start.getTime() - DAY), prevEnd: start };
  }
  if (cadence === 'weekly') {
    const today = startOfUTCDay(now);
    const dow = (today.getUTCDay() + 6) % 7;         // 0=Mon..6=Sun
    const thisMonday = new Date(today.getTime() - dow * DAY);
    const end = thisMonday;                          // start of this week ⇒ covers last week
    const start = new Date(end.getTime() - 7 * DAY);
    const { year, week } = isoWeek(start);
    const lastDay = new Date(end.getTime() - DAY);
    return { cadence, key: `${year}-W${String(week).padStart(2, '0')}`, start, end,
      label: `${longDate(start)} – ${longDate(lastDay)}`,
      prevStart: new Date(start.getTime() - 7 * DAY), prevEnd: start };
  }
  // monthly
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));   // 1st of this month ⇒ covers last month
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { cadence, key: monthKey(start), start, end,
    label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
    prevStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)), prevEnd: start };
}

// ── Snapshot ────────────────────────────────────────────────────────────────
export interface ReportSnapshot {
  cadence: Cadence;
  periodKey: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  orgName: string;
  generatedAt: string;
  totals: { members: number; activeMembers: number; monthlyPremium: number; monthlyCommission: number };
  window: {
    newMembers: number; newEnrolments: number; paidEnrolments: number;
    consultations: number; completedConsultations: number; triageSessions: number;
    prescriptions: number; claims: number; claimsAmount: number; approvedClaimsAmount: number;
  };
  deltas: { newMembers: number; consultations: number; enrolments: number; triageSessions: number };
  utilization: { consultsPerActiveMember: number; triagePerActiveMember: number };
  topPlans: { planName: string; underwriter: string; enrolments: number }[];
  channels: { channel: string; count: number }[];
  // Monthly executive extras.
  executive?: { lossRatioPct: number; telemedicineConsults: number };
  // AI-written executive takeaway (added by the controller before rendering;
  // absent when AI is off or generation failed).
  aiInsights?: { headline: string; bullets: string[] };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function computeReportSnapshot(orgId: string, period: Period, generatedAt = new Date()): Promise<ReportSnapshot> {
  const { start, end, prevStart, prevEnd } = period;
  const s = start.toISOString();
  const e = end.toISOString();

  // Coverage-chain scopes — every clause references only $1 (= orgId, already the
  // first param of each query below), so the params arrays are unchanged. A company
  // resolves to plain `org_id = $1`; an HMO/insurer spans its book via its plans.
  const actor = await resolveOrgActor(orgId);
  const mScope = memberVisibilityClause(actor, '', 1).sql;                                // members (unaliased: org_id / id)
  const mScopeM = memberVisibilityClause(actor, 'm', 1).sql;                              // members aliased m
  const xScope = coverageChainClause(actor, { alias: '', memberCol: 'member_id' }).sql;   // consult/enrol/claims/triage (unaliased)
  const enScope = coverageChainClause(actor, { alias: 'en', memberCol: 'member_id' }).sql; // enrolments aliased en

  const [
    org, members, consults, enrol, triage, rx, claims, premium, plans, channels, prev,
  ] = await Promise.all([
    query('SELECT name FROM organisations WHERE id = $1', [orgId]),
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM members WHERE ${mScope} AND created_at>=$2 AND created_at<$3) AS new_members,
         (SELECT COUNT(*)::int FROM members WHERE ${mScope} AND created_at<$3) AS total_members,
         (SELECT COUNT(*)::int FROM members WHERE ${mScope} AND status='active' AND created_at<$3) AS active_members`,
      [orgId, s, e]
    ),
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM consultations WHERE ${xScope} AND created_at>=$2 AND created_at<$3) AS consultations,
         (SELECT COUNT(*)::int FROM consultations WHERE ${xScope} AND status='completed' AND created_at>=$2 AND created_at<$3) AS completed`,
      [orgId, s, e]
    ),
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM enrolments WHERE ${xScope} AND enrolled_at>=$2 AND enrolled_at<$3) AS enrolments,
         (SELECT COUNT(*)::int FROM enrolments WHERE ${xScope} AND payment_status='paid' AND enrolled_at>=$2 AND enrolled_at<$3) AS paid`,
      [orgId, s, e]
    ),
    query(`SELECT COUNT(*)::int AS n FROM triage_sessions WHERE ${xScope} AND created_at>=$2 AND created_at<$3`, [orgId, s, e]),
    query(
      `SELECT COUNT(*)::int AS n FROM prescriptions p JOIN members m ON m.id=p.member_id
        WHERE ${mScopeM} AND p.created_at>=$2 AND p.created_at<$3`,
      [orgId, s, e]
    ),
    query(
      `SELECT COUNT(*)::int AS n,
              COALESCE(SUM(amount),0) AS amount,
              COALESCE(SUM(amount) FILTER (WHERE status IN ('approved','paid')),0) AS approved
         FROM claims WHERE ${xScope} AND created_at>=$2 AND created_at<$3`,
      [orgId, s, e]
    ),
    query(
      `SELECT COALESCE(SUM(pl.monthly_premium),0) AS premium,
              COALESCE(SUM(pl.monthly_premium*pl.commission_rate/100),0) AS commission
         FROM enrolments en JOIN insurance_plans pl ON en.plan_id=pl.id
        WHERE ${enScope} AND en.status='active'`,
      [orgId]
    ),
    query(
      `SELECT pl.name AS plan_name, pl.underwriter, COUNT(*)::int AS enrolments
         FROM enrolments en JOIN insurance_plans pl ON en.plan_id=pl.id
        WHERE ${enScope} AND en.enrolled_at>=$2 AND en.enrolled_at<$3
        GROUP BY pl.name, pl.underwriter ORDER BY enrolments DESC LIMIT 5`,
      [orgId, s, e]
    ),
    query(
      `SELECT channel, COUNT(*)::int AS count FROM members
        WHERE ${mScope} AND created_at>=$2 AND created_at<$3 GROUP BY channel ORDER BY count DESC`,
      [orgId, s, e]
    ),
    query(
      `SELECT
         (SELECT COUNT(*)::int FROM members WHERE ${mScope} AND created_at>=$2 AND created_at<$3) AS new_members,
         (SELECT COUNT(*)::int FROM consultations WHERE ${xScope} AND created_at>=$2 AND created_at<$3) AS consultations,
         (SELECT COUNT(*)::int FROM enrolments WHERE ${xScope} AND enrolled_at>=$2 AND enrolled_at<$3) AS enrolments,
         (SELECT COUNT(*)::int FROM triage_sessions WHERE ${xScope} AND created_at>=$2 AND created_at<$3) AS triage`,
      [orgId, prevStart.toISOString(), prevEnd.toISOString()]
    ),
  ]);

  const m = members.rows[0];
  const c = consults.rows[0];
  const en = enrol.rows[0];
  const cl = claims.rows[0];
  const pr = premium.rows[0];
  const p = prev.rows[0];
  const activeMembers = m.active_members || 0;
  const monthlyPremium = Number(pr.premium);
  const approvedClaims = Number(cl.approved);

  const snap: ReportSnapshot = {
    cadence: period.cadence,
    periodKey: period.key,
    periodLabel: period.label,
    periodStart: s,
    periodEnd: e,
    orgName: org.rows[0]?.name || 'Your organisation',
    generatedAt: generatedAt.toISOString(),
    totals: {
      members: m.total_members,
      activeMembers,
      monthlyPremium,
      monthlyCommission: Number(pr.commission),
    },
    window: {
      newMembers: m.new_members,
      newEnrolments: en.enrolments,
      paidEnrolments: en.paid,
      consultations: c.consultations,
      completedConsultations: c.completed,
      triageSessions: triage.rows[0].n,
      prescriptions: rx.rows[0].n,
      claims: cl.n,
      claimsAmount: Number(cl.amount),
      approvedClaimsAmount: approvedClaims,
    },
    deltas: {
      newMembers: m.new_members - p.new_members,
      consultations: c.consultations - p.consultations,
      enrolments: en.enrolments - p.enrolments,
      triageSessions: triage.rows[0].n - p.triage,
    },
    utilization: {
      consultsPerActiveMember: activeMembers ? round2(c.consultations / activeMembers) : 0,
      triagePerActiveMember: activeMembers ? round2(triage.rows[0].n / activeMembers) : 0,
    },
    topPlans: plans.rows.map((r) => ({ planName: r.plan_name, underwriter: r.underwriter, enrolments: r.enrolments })),
    channels: channels.rows.map((r) => ({ channel: r.channel || 'unknown', count: r.count })),
  };

  if (period.cadence === 'monthly') {
    snap.executive = {
      // Indicative loss ratio = approved claims this month ÷ active monthly premium.
      lossRatioPct: monthlyPremium ? round2((approvedClaims / monthlyPremium) * 100) : 0,
      // Completed virtual consults — each one a clinic/A&E visit potentially averted.
      telemedicineConsults: c.completed,
    };
  }
  return snap;
}

// ── Rendering ────────────────────────────────────────────────────────────────
const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-NG');
function money(n: number): string { return naira.format(n || 0); }
function delta(n: number): string {
  if (n > 0) return `<span style="color:#0a7b3b">▲ ${num.format(n)}</span>`;
  if (n < 0) return `<span style="color:#b04a4a">▼ ${num.format(Math.abs(n))}</span>`;
  return `<span style="color:#8a9a98">no change</span>`;
}
const CADENCE_TITLE: Record<Cadence, string> = {
  daily: 'Daily operations snapshot',
  weekly: 'Weekly engagement summary',
  monthly: 'Monthly executive report',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function statCard(label: string, value: string, sub?: string): string {
  return `<td style="padding:6px" width="33%" valign="top">
    <div style="border:1px solid #e3eded;border-radius:10px;padding:12px 14px">
      <div style="font:700 22px Arial,sans-serif;color:#11302e">${value}</div>
      <div style="font:12px Arial,sans-serif;color:#5e6e6e;margin-top:2px">${label}</div>
      ${sub ? `<div style="font:12px Arial,sans-serif;margin-top:4px">${sub}</div>` : ''}
    </div></td>`;
}
function statRow(cards: string[]): string {
  // pad to a multiple of 3 so the grid stays aligned
  const padded = [...cards];
  while (padded.length % 3 !== 0) padded.push('<td width="33%"></td>');
  let html = '';
  for (let i = 0; i < padded.length; i += 3) {
    html += `<tr>${padded.slice(i, i + 3).join('')}</tr>`;
  }
  return html;
}

export function renderReportHtml(snap: ReportSnapshot, branding: OrgBranding): string {
  const primary = branding.primaryColor || '#0a7b7b';
  const w = snap.window;
  const cards: string[] = [
    statCard('New members', num.format(w.newMembers), delta(snap.deltas.newMembers)),
    statCard('Consultations', num.format(w.consultations), delta(snap.deltas.consultations)),
    statCard('Triage sessions', num.format(w.triageSessions), delta(snap.deltas.triageSessions)),
    statCard('New enrolments', num.format(w.newEnrolments), delta(snap.deltas.enrolments)),
    statCard('Prescriptions issued', num.format(w.prescriptions)),
    statCard('Claims submitted', num.format(w.claims)),
  ];

  const isWeeklyPlus = snap.cadence !== 'daily';
  const isMonthly = snap.cadence === 'monthly';

  const utilBlock = isWeeklyPlus ? `
    <h3 style="font:700 15px Arial,sans-serif;color:#11302e;margin:22px 0 8px">Utilisation</h3>
    <table width="100%" cellpadding="0" cellspacing="0">${statRow([
      statCard('Active members', num.format(snap.totals.activeMembers)),
      statCard('Consults / active member', String(snap.utilization.consultsPerActiveMember)),
      statCard('Completed consults', num.format(w.completedConsultations)),
    ])}</table>` : '';

  const channelBlock = snap.channels.length ? `
    <h3 style="font:700 15px Arial,sans-serif;color:#11302e;margin:22px 0 8px">How members joined</h3>
    <table width="100%" cellpadding="6" cellspacing="0" style="font:13px Arial,sans-serif;color:#1f2d2b;border-collapse:collapse">
      ${snap.channels.map((ch) => `<tr>
        <td style="border-bottom:1px solid #eef3f3;text-transform:capitalize">${ch.channel}</td>
        <td style="border-bottom:1px solid #eef3f3;text-align:right">${num.format(ch.count)}</td></tr>`).join('')}
    </table>` : '';

  const plansBlock = (isWeeklyPlus && snap.topPlans.length) ? `
    <h3 style="font:700 15px Arial,sans-serif;color:#11302e;margin:22px 0 8px">Top plans this period</h3>
    <table width="100%" cellpadding="6" cellspacing="0" style="font:13px Arial,sans-serif;color:#1f2d2b;border-collapse:collapse">
      <tr style="color:#5e6e6e"><td style="border-bottom:2px solid #e3eded">Plan</td>
        <td style="border-bottom:2px solid #e3eded">Underwriter</td>
        <td style="border-bottom:2px solid #e3eded;text-align:right">Enrolments</td></tr>
      ${snap.topPlans.map((pl) => `<tr>
        <td style="border-bottom:1px solid #eef3f3">${pl.planName}</td>
        <td style="border-bottom:1px solid #eef3f3">${pl.underwriter || '—'}</td>
        <td style="border-bottom:1px solid #eef3f3;text-align:right">${num.format(pl.enrolments)}</td></tr>`).join('')}
    </table>` : '';

  const ai = snap.aiInsights;
  const aiBlock = (ai && (ai.headline || ai.bullets.length)) ? `
    <div style="background:#f3f7fe;border:1px solid #d8e3f7;border-radius:10px;padding:14px 16px;margin:0 0 18px;font:13px/1.6 Arial,sans-serif;color:#1f2d2b">
      <div style="font:700 12px Arial,sans-serif;color:#2f5fb0;letter-spacing:.04em;margin-bottom:6px">✨ AI INSIGHTS</div>
      ${ai.headline ? `<div style="font-weight:700;margin-bottom:6px">${escapeHtml(ai.headline)}</div>` : ''}
      ${ai.bullets.length ? `<ul style="margin:0;padding-left:18px">${ai.bullets.map((b) => `<li style="margin:2px 0">${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
      <div style="font:11px Arial,sans-serif;color:#8a9a98;margin-top:8px">AI-generated from this period's figures. Review before acting on it.</div>
    </div>` : '';

  const execBlock = (isMonthly && snap.executive) ? `
    <h3 style="font:700 15px Arial,sans-serif;color:#11302e;margin:22px 0 8px">Commercial &amp; value</h3>
    <table width="100%" cellpadding="0" cellspacing="0">${statRow([
      statCard('Active monthly premium', money(snap.totals.monthlyPremium)),
      statCard('Claims approved', money(w.approvedClaimsAmount)),
      statCard('Indicative loss ratio', `${snap.executive.lossRatioPct}%`),
    ])}</table>
    <div style="background:#f3faf8;border:1px solid #cfeae3;border-radius:10px;padding:14px 16px;margin-top:14px;font:13px/1.6 Arial,sans-serif;color:#1f2d2b">
      <strong>Value delivered.</strong> ${num.format(snap.executive.telemedicineConsults)} virtual consultations were completed this month —
      each one a clinic or A&amp;E visit potentially avoided for your members, at a fraction of the cost of in-person care.
    </div>
    <p style="font:11px Arial,sans-serif;color:#8a9a98;margin-top:8px">Loss ratio is indicative — approved claims this period ÷ active monthly premium. Final figures reconcile with your underwriter.</p>` : '';

  return `<div style="background:#f5f8f8;padding:24px 0">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e3eded">
    <div style="background:${primary};padding:22px 26px">
      <div style="font:700 18px Arial,sans-serif;color:#fff">${branding.displayName}</div>
      <div style="font:13px Arial,sans-serif;color:#dff2ef;margin-top:2px">${CADENCE_TITLE[snap.cadence]} · ${snap.periodLabel}</div>
    </div>
    <div style="padding:22px 26px">
      <p style="font:14px/1.6 Arial,sans-serif;color:#1f2d2b;margin:0 0 16px">
        Here is your ${snap.cadence} summary for <strong>${snap.orgName}</strong>, covering <strong>${snap.periodLabel}</strong>.
      </p>
      ${aiBlock}
      <table width="100%" cellpadding="0" cellspacing="0">${statRow(cards)}</table>
      ${utilBlock}
      ${plansBlock}
      ${execBlock}
      ${channelBlock}
      <hr style="border:none;border-top:1px solid #eef3f3;margin:22px 0">
      <p style="font:12px Arial,sans-serif;color:#8a9a98;margin:0">
        Generated by MobiCova Health on ${snap.generatedAt.slice(0, 10)}. Figures are scoped to your organisation.
        ${branding.supportContact ? `Questions? ${branding.supportContact}.` : ''}
      </p>
    </div>
  </div></div>`;
}

export function renderReportText(snap: ReportSnapshot): string {
  const w = snap.window;
  const lines = [
    `${CADENCE_TITLE[snap.cadence]} — ${snap.orgName}`,
    snap.periodLabel,
  ];
  if (snap.aiInsights && (snap.aiInsights.headline || snap.aiInsights.bullets.length)) {
    lines.push('', 'AI INSIGHTS');
    if (snap.aiInsights.headline) lines.push(snap.aiInsights.headline);
    for (const b of snap.aiInsights.bullets) lines.push(`  - ${b}`);
    lines.push('(AI-generated from this period’s figures. Review before acting on it.)');
  }
  lines.push(
    '',
    `New members:        ${w.newMembers}`,
    `Consultations:      ${w.consultations} (${w.completedConsultations} completed)`,
    `Triage sessions:    ${w.triageSessions}`,
    `New enrolments:     ${w.newEnrolments} (${w.paidEnrolments} paid)`,
    `Prescriptions:      ${w.prescriptions}`,
    `Claims submitted:   ${w.claims}`,
  );
  if (snap.cadence !== 'daily') {
    lines.push('', `Active members:     ${snap.totals.activeMembers}`,
      `Consults/active:    ${snap.utilization.consultsPerActiveMember}`);
  }
  if (snap.executive) {
    lines.push('', `Active premium:     ${money(snap.totals.monthlyPremium)}`,
      `Claims approved:    ${money(w.approvedClaimsAmount)}`,
      `Loss ratio (ind.):  ${snap.executive.lossRatioPct}%`,
      `Virtual consults:   ${snap.executive.telemedicineConsults} completed`);
  }
  lines.push('', `Generated by MobiCova Health · ${snap.generatedAt.slice(0, 10)}`);
  return lines.join('\n');
}
