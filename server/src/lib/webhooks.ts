import { createHmac, randomBytes } from 'crypto';
import { query } from '../config/database';
import { isPublicHost } from './ssrfGuard';

// The event catalogue insurers can subscribe to. Keep names stable — they are a
// public contract.
export const WEBHOOK_EVENTS = [
  'member.enrolled',
  'claim.created',
  'claim.status_changed',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number] | 'ping';

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

// Stripe-style signature: HMAC-SHA256 over "<timestamp>.<body>", returned as
// "t=<ts>,v1=<hex>". The receiver recomputes it with their stored secret to
// verify authenticity and guard against replay (via the timestamp).
export function signWebhook(secret: string, timestamp: number, body: string): string {
  const mac = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${mac}`;
}

interface EndpointRow {
  id: string;
  url: string;
  secret: string;
  events: string[];
}

async function recordDelivery(
  endpointId: string,
  event: string,
  statusCode: number | null,
  success: boolean,
  error: string | null
): Promise<void> {
  try {
    await query(
      `INSERT INTO webhook_deliveries (endpoint_id, event, status_code, success, error)
       VALUES ($1, $2, $3, $4, $5)`,
      [endpointId, event, statusCode, success, error ? error.slice(0, 500) : null]
    );
  } catch (err) {
    console.error('webhook delivery log failed:', err);
  }
}

// Resolve the endpoint host and confirm it's public right before fetching, so a
// URL that passed the save-time check can't reach an internal address via DNS
// (rebinding or a name that points inward). Returns an error string if blocked.
async function ssrfPreflight(url: string): Promise<string | null> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return 'invalid URL';
  }
  return (await isPublicHost(host)) ? null : 'blocked: endpoint resolves to a non-public address';
}

async function deliver(endpoint: EndpointRow, event: WebhookEvent, payload: object): Promise<void> {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const signature = signWebhook(endpoint.secret, ts, body);

  const blocked = await ssrfPreflight(endpoint.url);
  if (blocked) {
    await recordDelivery(endpoint.id, event, null, false, blocked);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      redirect: 'error', // don't follow redirects — they could bounce to an internal host
      headers: {
        'Content-Type': 'application/json',
        'X-MobiCova-Event': event,
        'X-MobiCova-Signature': signature,
        'User-Agent': 'MobiCova-Webhooks/1.0',
      },
      body,
      signal: controller.signal,
    });
    await recordDelivery(endpoint.id, event, res.status, res.ok, res.ok ? null : `HTTP ${res.status}`);
  } catch (err) {
    await recordDelivery(endpoint.id, event, null, false, (err as Error).message);
  } finally {
    clearTimeout(timeout);
  }
}

// Fan an event out to every active endpoint of an org that subscribes to it
// (empty events[] = subscribe to all). Fire-and-forget: never blocks or throws
// into the caller's request path. Each event gets a stable envelope.
export function emitEvent(orgId: string, event: WebhookEvent, data: object): void {
  void (async () => {
    try {
      const result = await query(
        `SELECT id, url, secret, events FROM webhook_endpoints
         WHERE org_id = $1 AND active = true
           AND (events = '{}' OR $2 = ANY(events))`,
        [orgId, event]
      );
      const endpoints = result.rows as EndpointRow[];
      if (endpoints.length === 0) return;

      const envelope = {
        id: `evt_${randomBytes(12).toString('hex')}`,
        event,
        created: new Date().toISOString(),
        data,
      };
      await Promise.all(endpoints.map((e) => deliver(e, event, envelope)));
    } catch (err) {
      console.error('emitEvent failed:', err);
    }
  })();
}

// Send a one-off ping to a specific endpoint (used by the "test" button). Returns
// whether the endpoint accepted it.
export async function sendPing(endpoint: EndpointRow): Promise<boolean> {
  const envelope = {
    id: `evt_${randomBytes(12).toString('hex')}`,
    event: 'ping' as const,
    created: new Date().toISOString(),
    data: { message: 'MobiCova webhook test event' },
  };
  const body = JSON.stringify(envelope);
  const ts = Math.floor(Date.now() / 1000);
  const signature = signWebhook(endpoint.secret, ts, body);

  const blocked = await ssrfPreflight(endpoint.url);
  if (blocked) {
    await recordDelivery(endpoint.id, 'ping', null, false, blocked);
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      redirect: 'error', // don't follow redirects — they could bounce to an internal host
      headers: {
        'Content-Type': 'application/json',
        'X-MobiCova-Event': 'ping',
        'X-MobiCova-Signature': signature,
        'User-Agent': 'MobiCova-Webhooks/1.0',
      },
      body,
      signal: controller.signal,
    });
    await recordDelivery(endpoint.id, 'ping', res.status, res.ok, res.ok ? null : `HTTP ${res.status}`);
    return res.ok;
  } catch (err) {
    await recordDelivery(endpoint.id, 'ping', null, false, (err as Error).message);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
