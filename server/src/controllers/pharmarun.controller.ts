import { Request, Response } from 'express';
import { createHmac } from 'crypto';
import { query } from '../config/database';
import { env } from '../config/env';
import { constantTimeEqual } from '../lib/safeCompare';
import { mapFulfilmentStatus } from '../lib/pharmacyFulfilment';

// POST /api/v1/pharmarun/webhook — order status updates from PharmaRun.
// Updates the matching prescription's external_status + our fulfilment_status so
// the member sees one live tracking view. Best-effort, but authenticated: the
// payload can rewrite prescription status + a member-facing tracking URL, so it
// must be signed. This path is served express.raw() → req.body is the raw Buffer.
//
// TODO(pharmarun): confirm the exact signature header/algorithm + payload field
// names from their API docs; the HMAC-SHA256(raw body) scheme below is our default.
export async function pharmarunWebhook(req: Request, res: Response): Promise<void> {
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');

  // Fail closed: until the shared secret is configured we cannot authenticate the
  // sender, and this endpoint mutates prescription records — so we accept (200 to
  // avoid retry storms) but do nothing. Set PHARMARUN_WEBHOOK_SECRET to enable.
  if (!env.pharmarunWebhookSecret) {
    console.warn('[pharmarun] webhook ignored — PHARMARUN_WEBHOOK_SECRET not set');
    res.status(200).json({ received: true, ignored: 'unconfigured' });
    return;
  }
  const sig = String(req.headers['x-pharmarun-signature'] || req.headers['x-signature'] || '')
    .replace(/^sha256=/i, '');
  const expected = createHmac('sha256', env.pharmarunWebhookSecret).update(raw).digest('hex');
  if (!sig || !constantTimeEqual(sig, expected)) {
    res.status(401).json({ error: 'invalid signature' });
    return;
  }

  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw.toString('utf8')); } catch { /* leave empty → no-op below */ }
  const b = body as { order_id?: unknown; id?: unknown; status?: unknown; tracking_url?: unknown; data?: Record<string, unknown> };

  // TODO(pharmarun): confirm exact payload field names.
  const orderId = String(b.order_id ?? b.id ?? b.data?.id ?? '');
  const status = String(b.status ?? b.data?.status ?? '');
  const trackingUrl = String(b.tracking_url ?? b.data?.tracking_url ?? '');

  if (orderId) {
    await query(
      `UPDATE prescriptions
          SET external_status   = $2,
              fulfilment_status = $3,
              tracking_url      = CASE WHEN $4 <> '' THEN $4 ELSE tracking_url END
        WHERE external_order_id = $1`,
      [orderId, status || 'unknown', mapFulfilmentStatus(status), trackingUrl]
    ).catch((err) => console.error('[pharmarun] webhook update failed:', err));
  }

  res.status(200).json({ received: true });
}
