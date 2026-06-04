import { Request, Response } from 'express';
import { query } from '../config/database';

// The Action centre surfaces everything needing a decision. Items are derived
// from live business rules each request (so they can't go stale); only the
// "read" flag is persisted (inbox_reads), keyed by a stable item id.

interface InboxAction { label: string; href: string; }
interface InboxItem {
  key: string;
  group: 'urgent' | 'review' | 'system';
  severity: 'crit' | 'urgent' | 'normal';
  icon: 'amber' | 'teal' | 'red' | 'blue';
  title: string;
  meta: string;
  actions: InboxAction[];
  createdAt: string;
  read: boolean;
}

const naira = (v: unknown) => `₦${Number(v || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

// GET /inbox
export async function getInbox(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;

  const reads = await query('SELECT item_key FROM inbox_reads WHERE org_id = $1', [orgId]);
  const readSet = new Set<string>(reads.rows.map((r) => r.item_key));

  const items: InboxItem[] = [];

  // 1. Overdue claims (open beyond the 5-day SLA).
  const overdue = await query(
    `SELECT c.id, c.reference, c.amount, c.currency, c.created_at, m.full_name AS member
     FROM claims c JOIN members m ON c.member_id = m.id
     WHERE c.org_id = $1 AND c.status IN ('submitted','under_review')
       AND c.created_at < NOW() - INTERVAL '5 days'
     ORDER BY c.created_at ASC LIMIT 20`,
    [orgId]
  );
  for (const r of overdue.rows) {
    items.push({
      key: `claim_overdue:${r.id}`, group: 'urgent', severity: 'crit', icon: 'red',
      title: `Claim ${r.reference} is overdue`,
      meta: `${naira(r.amount)} · ${r.member} · past the 5-day SLA`,
      actions: [{ label: 'Review claim', href: '/claims' }],
      createdAt: r.created_at, read: readSet.has(`claim_overdue:${r.id}`),
    });
  }

  // 2. New claims awaiting first review (within SLA).
  const fresh = await query(
    `SELECT c.id, c.reference, c.amount, c.created_at, m.full_name AS member
     FROM claims c JOIN members m ON c.member_id = m.id
     WHERE c.org_id = $1 AND c.status = 'submitted'
       AND c.created_at >= NOW() - INTERVAL '5 days'
     ORDER BY c.created_at DESC LIMIT 20`,
    [orgId]
  );
  for (const r of fresh.rows) {
    items.push({
      key: `claim_new:${r.id}`, group: 'review', severity: 'normal', icon: 'blue',
      title: `New claim ${r.reference} to review`,
      meta: `${naira(r.amount)} · ${r.member}`,
      actions: [{ label: 'Open claims', href: '/claims' }],
      createdAt: r.created_at, read: readSet.has(`claim_new:${r.id}`),
    });
  }

  // 3. Active enrolments with an unpaid premium.
  const unpaid = await query(
    `SELECT e.id, e.enrolled_at, m.full_name AS member, pl.name AS plan
     FROM enrolments e JOIN members m ON e.member_id = m.id JOIN insurance_plans pl ON e.plan_id = pl.id
     WHERE e.org_id = $1 AND e.payment_status = 'unpaid' AND e.status = 'active'
     ORDER BY e.enrolled_at DESC LIMIT 20`,
    [orgId]
  );
  for (const r of unpaid.rows) {
    items.push({
      key: `enrol_unpaid:${r.id}`, group: 'review', severity: 'normal', icon: 'amber',
      title: `Premium unpaid — ${r.member}`,
      meta: `${r.plan}`,
      actions: [{ label: 'Go to Insurance', href: '/insurance' }],
      createdAt: r.enrolled_at, read: readSet.has(`enrol_unpaid:${r.id}`),
    });
  }

  // 4. Webhook endpoints with recent delivery failures.
  const failing = await query(
    `SELECT w.id, w.url, COUNT(*)::int AS fails, MAX(d.created_at) AS last_fail
     FROM webhook_endpoints w JOIN webhook_deliveries d ON d.endpoint_id = w.id
     WHERE w.org_id = $1 AND d.success = false AND d.created_at >= NOW() - INTERVAL '7 days'
     GROUP BY w.id, w.url HAVING COUNT(*) > 0
     ORDER BY MAX(d.created_at) DESC LIMIT 10`,
    [orgId]
  );
  for (const r of failing.rows) {
    items.push({
      key: `webhook_fail:${r.id}:${r.fails}`, group: 'system', severity: 'urgent', icon: 'red',
      title: 'Webhook deliveries are failing',
      meta: `${r.url} · ${r.fails} failed in the last 7 days`,
      actions: [{ label: 'Inspect deliveries', href: '/settings/developer' }],
      createdAt: r.last_fail, read: readSet.has(`webhook_fail:${r.id}:${r.fails}`),
    });
  }

  // "Done today" — read-only activity feed from the audit log.
  const done = await query(
    `SELECT action, target_label, actor_email, created_at
     FROM audit_log WHERE org_id = $1 AND created_at >= date_trunc('day', NOW())
     ORDER BY created_at DESC LIMIT 12`,
    [orgId]
  );

  const counts = {
    urgent: items.filter((i) => i.group === 'urgent').length,
    review: items.filter((i) => i.group === 'review').length,
    system: items.filter((i) => i.group === 'system').length,
    doneToday: done.rowCount,
  };
  const unread = items.filter((i) => !i.read).length;

  res.json({ items, done: done.rows, counts, unread });
}

// POST /inbox/read { keys: string[] } — mark derived items read (idempotent).
export async function markInboxRead(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const keys: string[] = Array.isArray(req.body?.keys) ? req.body.keys.map(String).slice(0, 200) : [];
  for (const key of keys) {
    await query(
      `INSERT INTO inbox_reads (org_id, item_key) VALUES ($1, $2)
       ON CONFLICT (org_id, item_key) DO NOTHING`,
      [orgId, key.slice(0, 160)]
    );
  }
  res.json({ ok: true, marked: keys.length });
}
