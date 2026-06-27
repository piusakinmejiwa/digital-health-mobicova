import { Request, Response } from 'express';
import { query } from '../config/database';
import { CATEGORIES, DEFAULT_EMAIL, isCategory, listForUser } from '../lib/notify';

// GET /notifications?limit= — the signed-in user's feed + unread count.
export async function getNotifications(req: Request, res: Response): Promise<void> {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const feed = await listForUser(req.user!.orgId, req.user!.userId, limit);
  res.json(feed);
}

// POST /notifications/read { ids: string[] } — mark specific notifications read.
export async function markNotificationsRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 200) : [];
  for (const id of ids) {
    await query(
      `INSERT INTO notification_reads (user_id, notification_id) VALUES ($1, $2)
       ON CONFLICT (user_id, notification_id) DO NOTHING`,
      [userId, id]
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
