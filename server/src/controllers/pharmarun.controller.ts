import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { mapFulfilmentStatus } from '../lib/pharmacyFulfilment';

// POST /api/v1/pharmarun/webhook — order status updates from PharmaRun.
// Updates the matching prescription's external_status + our fulfilment_status so
// the member sees one live tracking view. Always 200 (best-effort) so PharmaRun
// doesn't retry-storm us on a transient error.
//
// TODO(pharmarun): verify the signature using their documented scheme + secret,
// and confirm the payload field names (order id, status, tracking url).
export async function pharmarunWebhook(req: Request, res: Response): Promise<void> {
  // TODO(pharmarun): confirm the signature header name + algorithm (e.g. HMAC-SHA256
  // of the raw body) and verify against PHARMARUN_WEBHOOK_SECRET before trusting.
  if (env.pharmarunWebhookSecret) {
    const sig = String(req.headers['x-pharmarun-signature'] || req.headers['x-signature'] || '');
    if (!sig) {
      // Left tolerant until we confirm the scheme; tighten to a 401 once known.
      console.warn('[pharmarun] webhook received without a signature header');
    }
  }

  // TODO(pharmarun): confirm exact payload field names.
  const orderId = String(req.body?.order_id ?? req.body?.id ?? req.body?.data?.id ?? '');
  const status = String(req.body?.status ?? req.body?.data?.status ?? '');
  const trackingUrl = String(req.body?.tracking_url ?? req.body?.data?.tracking_url ?? '');

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
