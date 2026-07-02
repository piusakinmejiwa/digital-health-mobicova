import { Request, Response } from 'express';
import { query } from '../config/database';
import { CATEGORIES, DEFAULT_EMAIL, isCategory, listForUser } from '../lib/notify';
import { getOrgSlack, isSlackWebhookUrl, maskSlackUrl, postSlackMessage } from '../lib/slack';

// GET /notifications?limit= — the signed-in user's feed + unread count.
export async function getNotifications(req: Request, res: Response): Promise<void> {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const feed = await listForUser(req.user!.orgId, req.user!.userId, limit);
  res.json(feed);
}

// POST /notifications/read { ids: string[] } — mark specific notifications read.
export async function markNotificationsRead(req: Request, res: Response): Promise<void> {
  const { orgId, userId } = req.user!;
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 200) : [];
  for (const id of ids) {
    // Only mark read a notification that actually belongs to the caller's org —
    // don't let a client write read-state rows referencing arbitrary/foreign ids.
    await query(
      `INSERT INTO notification_reads (user_id, notification_id)
       SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM notifications WHERE id = $2 AND org_id = $3)
       ON CONFLICT (user_id, notification_id) DO NOTHING`,
      [userId, id, orgId]
    );
  }
  res.json({ ok: true });
}

// POST /notifications/read-all — mark every currently-visible notification read.
export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  const { orgId, userId } = req.user!;
  await query(
    `INSERT INTO notification_reads (user_id, notification_id)
     SELECT $2, n.id FROM notifications n
      WHERE n.org_id = $1 AND n.created_at >= now() - interval '60 days'
     ON CONFLICT (user_id, notification_id) DO NOTHING`,
    [orgId, userId]
  );
  res.json({ ok: true });
}

// GET /notifications/prefs — available categories + this user's settings.
export async function getNotificationPrefs(req: Request, res: Response): Promise<void> {
  const r = await query('SELECT muted, email FROM notification_prefs WHERE user_id = $1', [req.user!.userId]);
  const row = r.rows[0];
  res.json({
    categories: CATEGORIES,
    muted: row?.muted || [],
    email: row?.email || DEFAULT_EMAIL,
    hasPrefs: Boolean(row),
  });
}

// PUT /notifications/prefs { muted: string[], email: string[] }
export async function updateNotificationPrefs(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const clean = (v: unknown): string[] =>
    (Array.isArray(v) ? v.map(String) : []).filter(isCategory);
  const muted = clean(req.body?.muted);
  const email = clean(req.body?.email);
  await query(
    `INSERT INTO notification_prefs (user_id, muted, email, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE SET muted = $2, email = $3, updated_at = now()`,
    [userId, muted, email]
  );
  res.json({ muted, email });
}

// --- Per-org Slack integration (org-level; mutations are admin-only) ---
const ALL_CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

// GET /notifications/slack — current org Slack config (URL only ever masked).
export async function getSlackConfig(req: Request, res: Response): Promise<void> {
  const cfg = await getOrgSlack(req.user!.orgId);
  res.json({
    categories: CATEGORIES,
    connected: Boolean(cfg?.url),
    active: cfg?.active ?? true,
    enabled: cfg?.categories ?? ALL_CATEGORY_KEYS,
    urlHint: cfg?.url ? maskSlackUrl(cfg.url) : '',
  });
}

// PUT /notifications/slack { webhookUrl?, active?, categories? } — connect/update.
// An empty webhookUrl disconnects. Categories default to all on first connect.
export async function updateSlackConfig(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  // webhookUrl is only touched when explicitly provided (so saving category/active
  // changes keeps the stored secret). An empty string disconnects.
  const hasUrl = req.body?.webhookUrl !== undefined;
  const url = String(req.body?.webhookUrl ?? '').trim();
  if (hasUrl && url && !isSlackWebhookUrl(url)) {
    res.status(400).json({ error: 'Enter a valid Slack Incoming Webhook URL (https://hooks.slack.com/services/…).' });
    return;
  }
  const active = req.body?.active !== false;
  const categories = Array.isArray(req.body?.categories)
    ? req.body.categories.map(String).filter(isCategory)
    : ALL_CATEGORY_KEYS;
  const r = await query(
    `INSERT INTO org_slack (org_id, webhook_url, active, categories, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (org_id) DO UPDATE SET
        webhook_url = CASE WHEN $5 THEN $2 ELSE org_slack.webhook_url END,
        active = $3, categories = $4, updated_at = now()
     RETURNING webhook_url`,
    [orgId, url, active, categories, hasUrl]
  );
  res.json({ connected: Boolean(r.rows[0]?.webhook_url), active, categories });
}

// POST /notifications/slack/test — send a harmless test message to the channel.
export async function testSlack(req: Request, res: Response): Promise<void> {
  const cfg = await getOrgSlack(req.user!.orgId);
  if (!cfg?.url) { res.status(400).json({ error: 'Connect a Slack webhook first.' }); return; }
  const r = await postSlackMessage(cfg.url, ':wave: *MobiCova is connected to this channel.* Operational alerts will appear here — no member data is ever posted.');
  if (!r.ok) { res.status(502).json({ error: `Slack rejected the test (${r.error}). Check the webhook URL and channel.` }); return; }
  res.json({ ok: true });
}
