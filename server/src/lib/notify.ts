import { query } from '../config/database';
import { sendEmail } from './email';
import { env } from '../config/env';

// Notifications Centre engine. Org-scoped events, per-user read state + prefs.
// notify() is best-effort and never throws — business flows fire-and-forget.

export type NotificationCategory =
  | 'claims' | 'enrolments' | 'billing' | 'reports' | 'members' | 'system' | 'security';

export interface CategoryMeta { key: NotificationCategory; label: string; description: string; }
export const CATEGORIES: CategoryMeta[] = [
  { key: 'claims', label: 'Claims', description: 'New and updated insurance claims' },
  { key: 'enrolments', label: 'Enrolments', description: 'New member enrolments & premium status' },
  { key: 'billing', label: 'Billing & usage', description: 'Plan limits, usage thresholds and invoices' },
  { key: 'reports', label: 'Reports', description: 'Scheduled reports generated for your organisation' },
  { key: 'members', label: 'Members', description: 'Member sign-ups and milestones' },
  { key: 'system', label: 'System', description: 'Integration health and operational alerts' },
  { key: 'security', label: 'Security', description: 'Sign-in and account-security events' },
];
const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as string[];
export function isCategory(v: unknown): v is NotificationCategory {
  return typeof v === 'string' && CATEGORY_KEYS.includes(v);
}

// Categories emailed by default (low-volume, important) until a user changes prefs.
export const DEFAULT_EMAIL: NotificationCategory[] = ['billing', 'security'];

export interface NotifyInput {
  orgId: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  href?: string;
  severity?: 'info' | 'warn' | 'critical';
  dedupeKey?: string;     // suppress duplicate events per org (e.g. a usage threshold)
}

// Create a notification for an org and email any users who've opted in. Resilient:
// logs and returns on any failure so callers can `void notify(...)`.
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const ins = await query(
      `INSERT INTO notifications (org_id, category, severity, title, body, href, dedupe_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (org_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [input.orgId, input.category, input.severity || 'info', input.title,
        input.body || '', input.href || '', input.dedupeKey || null]
    );
    if (ins.rows.length === 0) return; // deduped — already notified

    if (!env.resendApiKey) return;     // no email provider configured

    // Email the org's active users who want this category by email (and haven't muted it).
    const users = await query(
      `SELECT u.email, u.full_name,
              COALESCE(p.email, $2::text[]) AS email_cats,
              COALESCE(p.muted, '{}'::text[]) AS muted
         FROM users u
         LEFT JOIN notification_prefs p ON p.user_id = u.id
        WHERE u.org_id = $1 AND u.is_active = true`,
      [input.orgId, DEFAULT_EMAIL]
    );
    const recipients = users.rows.filter((u) =>
      (u.email_cats as string[]).includes(input.category) &&
      !(u.muted as string[]).includes(input.category)
    );
    for (const u of recipients) {
      const link = input.href ? `${env.clientUrl}${input.href}` : env.clientUrl;
      void sendEmail({
        to: u.email,
        subject: `MobiCova · ${input.title}`,
        html: `<div style="font:15px/1.6 Arial,sans-serif;color:#1f2d2b;max-width:560px">
          <h2 style="color:#0a7b7b;margin:0 0 6px">${input.title}</h2>
          ${input.body ? `<p style="margin:0 0 16px">${input.body}</p>` : ''}
          <p><a href="${link}" style="color:#0a7b7b">Open in MobiCova →</a></p>
          <hr style="border:none;border-top:1px solid #e3eded;margin:18px 0">
          <p style="color:#5e6e6e;font-size:12px">You’re receiving this because email is on for “${input.category}” notifications. Change this in Settings → Notifications.</p>
        </div>`,
        text: `${input.title}\n\n${input.body || ''}\n\n${link}`,
      });
    }
  } catch (err) {
    console.error('[notify] failed:', (err as Error).message);
  }
}

export interface NotificationRow {
  id: string; category: string; severity: string; title: string;
  body: string; href: string; created_at: string; read: boolean;
}

// Per-user feed: org notifications minus the user's muted categories, with the
// user's own read flag. Bounded to the last 60 days.
export async function listForUser(orgId: string, userId: string, limit = 30): Promise<{ items: NotificationRow[]; unread: number }> {
  const prefs = await query('SELECT muted FROM notification_prefs WHERE user_id = $1', [userId]);
  const muted: string[] = prefs.rows[0]?.muted || [];

  const [items, unread] = await Promise.all([
    query(
      `SELECT n.id, n.category, n.severity, n.title, n.body, n.href, n.created_at,
              (r.user_id IS NOT NULL) AS read
         FROM notifications n
         LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = $2
        WHERE n.org_id = $1 AND n.category <> ALL($3) AND n.created_at >= now() - interval '60 days'
        ORDER BY n.created_at DESC LIMIT $4`,
      [orgId, userId, muted, limit]
    ),
    query(
      `SELECT COUNT(*)::int AS n
         FROM notifications n
         LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = $2
        WHERE n.org_id = $1 AND n.category <> ALL($3)
          AND r.user_id IS NULL AND n.created_at >= now() - interval '60 days'`,
      [orgId, userId, muted]
    ),
  ]);
  return { items: items.rows, unread: unread.rows[0].n };
}
