import { randomBytes } from 'crypto';
import { query } from '../config/database';
import { hashApiKey } from './apiKeys';
import { signWebhook } from './webhooks';
import { isPublicHost } from './ssrfGuard';

// --- Distribution-partner API keys -------------------------------------
// A distinct prefix (mk_dist_) from public read keys (mk_live_) so the two
// surfaces can't be confused. Stored as a SHA-256 hash + short display prefix,
// exactly like public API keys (lib/apiKeys). The full key is shown once.
const KEY_BODY_BYTES = 24;
const PREFIX_LEN = 16; // "mk_dist_" (8) + 8 hex

export interface GeneratedDistKey { fullKey: string; prefix: string; hash: string; }

export function generateDistributionKey(): GeneratedDistKey {
  const fullKey = `mk_dist_${randomBytes(KEY_BODY_BYTES).toString('hex')}`;
  return { fullKey, prefix: fullKey.slice(0, PREFIX_LEN), hash: hashApiKey(fullKey) };
}
export function distKeyPrefix(fullKey: string): string { return fullKey.slice(0, PREFIX_LEN); }

// --- Quote calculation --------------------------------------------------
// MVP: the plan's monthly premium is the quote. Dependants are accepted for
// forward-compatibility but don't change the price yet (family plans already
// price in dependants) — real rating rules plug in here later.
export interface PlanRow {
  id: string; name: string; plan_type: string; monthly_premium: string | number;
  currency: string; cover_amount: string | number; benefits: string[]; description: string;
}
export function quotePremium(plan: PlanRow): { currency: string; monthlyPremium: number } {
  return { currency: plan.currency || 'NGN', monthlyPremium: Number(plan.monthly_premium) };
}

// Public shape of a plan/product returned to distribution partners.
export function productView(p: PlanRow) {
  return {
    planId: p.id,
    name: p.name,
    type: p.plan_type,
    currency: p.currency || 'NGN',
    monthlyPremium: Number(p.monthly_premium),
    coverAmount: Number(p.cover_amount),
    benefits: p.benefits || [],
    description: p.description || '',
  };
}

// --- Outbound partner webhooks -----------------------------------------
export type DistWebhookEvent =
  | 'policy.activated' | 'policy.cancelled' | 'policy.expiring' | 'claim.status_changed';

export function generatePartnerWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

interface PartnerHook { id: string; webhook_url: string; webhook_secret: string; }

// Fire-and-forget signed delivery to a partner's webhook URL. Same envelope +
// HMAC scheme as the tenant webhooks (lib/webhooks), and the same SSRF preflight
// (resolve host, reject private/loopback/link-local) + no redirects.
export function emitPartnerEvent(partner: PartnerHook, event: DistWebhookEvent, data: object): void {
  if (!partner.webhook_url || !partner.webhook_secret) return;
  void (async () => {
    try {
      let host: string;
      try { host = new URL(partner.webhook_url).hostname; } catch { return; }
      if (!(await isPublicHost(host))) {
        console.warn('[distribution] partner webhook blocked (non-public host):', host);
        return;
      }
      const envelope = { id: `evt_${randomBytes(12).toString('hex')}`, event, created: new Date().toISOString(), data };
      const body = JSON.stringify(envelope);
      const ts = Math.floor(Date.now() / 1000);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        await fetch(partner.webhook_url, {
          method: 'POST',
          redirect: 'error',
          headers: {
            'Content-Type': 'application/json',
            'X-MobiCova-Event': event,
            'X-MobiCova-Signature': signWebhook(partner.webhook_secret, ts, body),
            'User-Agent': 'MobiCova-Distribution/1.0',
          },
          body,
          signal: controller.signal,
        });
      } finally { clearTimeout(timeout); }
    } catch (err) {
      console.error('[distribution] partner webhook delivery failed:', (err as Error).message);
    }
  })();
}

// Load a partner (with hook fields) by id — used when emitting events from other
// parts of the app (e.g. claim status changes on a partner-sourced policy).
export async function getPartnerHook(partnerId: string): Promise<PartnerHook | null> {
  const r = await query('SELECT id, webhook_url, webhook_secret FROM distribution_partners WHERE id = $1', [partnerId]);
  return r.rows[0] || null;
}
