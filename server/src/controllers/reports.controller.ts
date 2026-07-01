import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { sendEmail } from '../lib/email';
import { getOrgBranding } from '../lib/branding';
import { constantTimeEqual } from '../lib/safeCompare';
import {
  CADENCES, isCadence, periodFor, computeReportSnapshot,
  renderReportHtml, renderReportText, type Cadence,
} from '../lib/reports';
import { generateReportInsight } from '../lib/reportInsights';
import { notify } from '../lib/notify';

const CADENCE_SUBJECT: Record<Cadence, string> = {
  daily: 'Daily snapshot',
  weekly: 'Weekly summary',
  monthly: 'Monthly report',
};

function cleanRecipients(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : String(input || '').split(/[,\n;]+/);
  const seen = new Set<string>();
  for (const r of raw) {
    const e = String(r || '').trim().toLowerCase();
    if (e && /.+@.+\..+/.test(e)) seen.add(e.slice(0, 255));
  }
  return [...seen].slice(0, 25);
}

// Compute → (optionally) deliver → (optionally) persist a single org's report for
// the most recently completed period of `cadence`. Shared by the cron, "send
// now" and "preview" paths.
async function buildReport(
  orgId: string, cadence: Cadence, recipients: string[], now: Date,
  opts: { send: boolean; persist: boolean },
): Promise<{ sent: number; failed: number; snapshot: unknown; html: string; periodKey: string; periodLabel: string }> {
  const period = periodFor(cadence, now);
  const snapshot = await computeReportSnapshot(orgId, period, now);
  // AI executive takeaway — best-effort; the report still renders if it's null.
  snapshot.aiInsights = (await generateReportInsight(snapshot)) ?? undefined;
  const branding = await getOrgBranding(orgId);
  const html = renderReportHtml(snapshot, branding);
  const text = renderReportText(snapshot);

  let sent = 0, failed = 0;
  if (opts.send) {
    const subject = `${branding.displayName} — ${CADENCE_SUBJECT[cadence]} · ${period.label}`;
    for (const to of recipients) {
      const r = await sendEmail({ to, subject, html, text });
      if (r.sent) sent++; else failed++;
    }
  }

  if (opts.persist) {
    const status = !opts.send ? 'generated' : failed > 0 && sent === 0 ? 'failed' : 'sent';
    await query(
      `INSERT INTO report_runs (org_id, cadence, period_key, period_start, period_end, snapshot, recipients, sent_count, status)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
       ON CONFLICT (org_id, cadence, period_key) DO UPDATE
         SET snapshot = EXCLUDED.snapshot, recipients = EXCLUDED.recipients,
             sent_count = EXCLUDED.sent_count, status = EXCLUDED.status,
             period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end,
             created_at = now()`,
      [orgId, cadence, period.key, period.start.toISOString(), period.end.toISOString(),
        JSON.stringify(snapshot), recipients, sent, status]
    );
    // In-app heads-up that the period's report was generated/sent (one per period).
    void notify({
      orgId, category: 'reports', severity: 'info',
      title: `${cadence[0].toUpperCase()}${cadence.slice(1)} report ready`,
      body: `Your ${cadence} report for ${period.label} has been generated${opts.send ? ` and emailed to ${sent} recipient(s)` : ''}.`,
      href: '/analytics',
      dedupeKey: `report:${cadence}:${period.key}`,
    });
  }

  return { sent, failed, snapshot, html, periodKey: period.key, periodLabel: period.label };
}

// ── Cron trigger ──────────────────────────────────────────────────────────────
// POST /reports/run[?cadence=daily|weekly|monthly]  — for an external scheduler.
// Guarded by a shared secret (x-cron-secret header or ?secret=). With no cadence,
// runs all three (point the daily cron at ?cadence=daily, etc.). Idempotent: an
// org+cadence already sent for the current period is skipped, so a double-fire
// never double-sends.
export async function runScheduledReports(req: Request, res: Response): Promise<void> {
  const secret = String(req.headers['x-cron-secret'] || req.query?.secret || '');
  if (!env.reportsCronSecret || !constantTimeEqual(secret, env.reportsCronSecret)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const requested = String(req.query?.cadence || '').toLowerCase();
  const cadences: Cadence[] = isCadence(requested) ? [requested] : CADENCES;
  const now = new Date();

  const summary = { ran: [] as unknown[], sent: 0, skipped: 0, failed: 0 };
  for (const cadence of cadences) {
    const subs = await query(
      `SELECT org_id, recipients FROM report_subscriptions
        WHERE cadence = $1 AND is_active = true AND array_length(recipients, 1) > 0`,
      [cadence]
    );
    const period = periodFor(cadence, now);
    for (const sub of subs.rows) {
      const orgId: string = sub.org_id;
      const recipients: string[] = sub.recipients || [];
      // Already delivered for this period? Skip (idempotent).
      const done = await query(
        `SELECT 1 FROM report_runs WHERE org_id=$1 AND cadence=$2 AND period_key=$3 AND status='sent' LIMIT 1`,
        [orgId, cadence, period.key]
      );
      if (done.rows.length) { summary.skipped++; continue; }
      try {
        const r = await buildReport(orgId, cadence, recipients, now, { send: true, persist: true });
        summary.sent += r.sent; summary.failed += r.failed;
        summary.ran.push({ orgId, cadence, period: period.key, sent: r.sent, failed: r.failed });
      } catch (err) {
        summary.failed++;
        summary.ran.push({ orgId, cadence, period: period.key, error: (err as Error).message });
      }
    }
  }
  res.json(summary);
}

// ── Admin: per-org configuration & archive ────────────────────────────────────
export async function adminGetOrgReports(req: Request, res: Response): Promise<void> {
  const orgId = String(req.params.id);
  const [subs, runs] = await Promise.all([
    query(`SELECT cadence, recipients, is_active, updated_at FROM report_subscriptions WHERE org_id = $1`, [orgId]),
    query(
      `SELECT id, cadence, period_key, period_start, period_end, recipients, sent_count, status, created_at
         FROM report_runs WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [orgId]
    ),
  ]);
  // Always return a row for each cadence so the UI can render the full set.
  const byCadence = new Map(subs.rows.map((r) => [r.cadence, r]));
  const subscriptions = CADENCES.map((cadence) => {
    const row = byCadence.get(cadence);
    return {
      cadence,
      recipients: (row?.recipients as string[]) || [],
      isActive: row ? Boolean(row.is_active) : false,
    };
  });
  res.json({ subscriptions, runs: runs.rows, emailConfigured: Boolean(env.resendApiKey) });
}

export async function adminSaveOrgReports(req: Request, res: Response): Promise<void> {
  const orgId = String(req.params.id);
  const incoming = Array.isArray(req.body?.subscriptions) ? req.body.subscriptions : [];
  for (const sub of incoming) {
    if (!isCadence(sub?.cadence)) continue;
    const recipients = cleanRecipients(sub.recipients);
    const isActive = Boolean(sub.isActive) && recipients.length > 0;
    await query(
      `INSERT INTO report_subscriptions (org_id, cadence, recipients, is_active, updated_at)
       VALUES ($1,$2,$3,$4, now())
       ON CONFLICT (org_id, cadence) DO UPDATE
         SET recipients = EXCLUDED.recipients, is_active = EXCLUDED.is_active, updated_at = now()`,
      [orgId, sub.cadence, recipients, isActive]
    );
  }
  await adminGetOrgReports(req, res);
}

// Preview a report without sending or persisting — returns the snapshot + HTML.
export async function adminPreviewOrgReport(req: Request, res: Response): Promise<void> {
  const orgId = String(req.params.id);
  const cadence = String(req.body?.cadence || req.query?.cadence || '').toLowerCase();
  if (!isCadence(cadence)) { res.status(400).json({ error: 'cadence must be daily, weekly or monthly' }); return; }
  const r = await buildReport(orgId, cadence, [], new Date(), { send: false, persist: false });
  res.json({ snapshot: r.snapshot, html: r.html, periodLabel: r.periodLabel });
}

// Generate + email the report immediately (and archive the run). Recipients
// default to the saved subscription if not supplied in the body.
export async function adminSendOrgReportNow(req: Request, res: Response): Promise<void> {
  const orgId = String(req.params.id);
  const cadence = String(req.body?.cadence || '').toLowerCase();
  if (!isCadence(cadence)) { res.status(400).json({ error: 'cadence must be daily, weekly or monthly' }); return; }

  let recipients = cleanRecipients(req.body?.recipients);
  if (recipients.length === 0) {
    const saved = await query(`SELECT recipients FROM report_subscriptions WHERE org_id=$1 AND cadence=$2`, [orgId, cadence]);
    recipients = (saved.rows[0]?.recipients as string[]) || [];
  }
  if (recipients.length === 0) { res.status(400).json({ error: 'No recipients configured for this report.' }); return; }

  const r = await buildReport(orgId, cadence, recipients, new Date(), { send: true, persist: true });
  res.json({ sent: r.sent, failed: r.failed, recipients, periodLabel: r.periodLabel, emailConfigured: Boolean(env.resendApiKey) });
}
