import { query } from '../config/database';
import { env } from '../config/env';
import { isPublicHost } from './ssrfGuard';

// Per-tenant Slack notifications. MobiCova posts operational headlines to an org's
// Slack channel via an Incoming Webhook. Deliberately PHI-SAFE: we post the
// notification TITLE + a deep link only — never the body (which can contain member
// names) — because Slack is a third-party service and a cross-border data flow.

// Only genuine Slack incoming-webhook URLs are accepted.
const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;
export function isSlackWebhookUrl(url: string): boolean {
  return SLACK_WEBHOOK_RE.test((url || '').trim());
}

// Mask the secret token portion for display (never return the full URL to the UI).
export function maskSlackUrl(url: string): string {
  const m = url.match(/^https:\/\/hooks\.slack\.com\/services\/([^/]+)\/([^/]+)\/.+$/);
  return m ? `hooks.slack.com/services/${m[1]}/${m[2]}/••••••` : 'hooks.slack.com/services/••••';
}

export async function postSlackMessage(url: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSlackWebhookUrl(url)) return { ok: false, error: 'not a Slack incoming-webhook URL' };
  let host: string;
  try { host = new URL(url).hostname; } catch { return { ok: false, error: 'invalid URL' }; }
  if (!(await isPublicHost(host))) return { ok: false, error: 'blocked host' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    return res.ok ? { ok: true } : { ok: false, error: `slack-${res.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(timeout);
  }
}

export interface OrgSlackCfg { url: string; active: boolean; categories: string[]; }
export async function getOrgSlack(orgId: string): Promise<OrgSlackCfg | null> {
  const r = await query('SELECT webhook_url, active, categories FROM org_slack WHERE org_id = $1', [orgId]);
  const row = r.rows[0];
  if (!row || !row.webhook_url) return null;
  return { url: row.webhook_url, active: row.active, categories: row.categories || [] };
}

// Platform-ops: post to MobiCova's OWN team channel (env-configured Incoming
// Webhook) for internal signals like new org / partner sign-ups. Business events
// only — no PHI. No-op when PLATFORM_SLACK_WEBHOOK_URL is unset. Never throws.
export function emitPlatformSlack(text: string): void {
  if (!env.platformSlackWebhookUrl) return;
  void postSlackMessage(env.platformSlackWebhookUrl, text);
}

// Fire-and-forget: post a PHI-safe headline to the org's Slack if it's connected,
// active, and the category is enabled. Called from notify(). Never throws.
export function emitSlack(orgId: string, category: string, title: string, href?: string): void {
  void (async () => {
    try {
      const cfg = await getOrgSlack(orgId);
      if (!cfg || !cfg.active) return;
      if (!cfg.categories.includes(category)) return;
      const link = href ? ` — <${env.clientUrl}${href}|Open in MobiCova>` : '';
      await postSlackMessage(cfg.url, `*${title}*${link}`);
    } catch (err) {
      console.error('[slack] emit failed:', (err as Error).message);
    }
  })();
}
