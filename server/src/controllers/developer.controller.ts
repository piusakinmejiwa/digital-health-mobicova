import { Request, Response } from 'express';
import { query } from '../config/database';
import { recordAudit } from '../lib/audit';
import { generateApiKey } from '../lib/apiKeys';
import { generateWebhookSecret, WEBHOOK_EVENTS, sendPing } from '../lib/webhooks';

// Org-admin self-service for the public API: manage API keys and webhook
// endpoints. All handlers are scoped to the caller's organisation and sit behind
// authenticate + requireRole('admin').

// ── API keys ────────────────────────────────────────────────────────────
export async function listApiKeys(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const result = await query(
    `SELECT id, name, key_prefix, last_used_at, revoked, created_at
     FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
  res.json(result.rows);
}

export async function createApiKey(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const name = String(req.body?.name || '').slice(0, 120) || 'Default key';
  const { fullKey, prefix, hash } = generateApiKey();

  const result = await query(
    `INSERT INTO api_keys (org_id, name, key_prefix, key_hash, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, key_prefix, last_used_at, revoked, created_at`,
    [orgId, name, prefix, hash, req.user!.userId]
  );

  await recordAudit(req, {
    action: 'apikey.create', targetType: 'api_key', targetId: result.rows[0].id,
    targetLabel: name, orgId,
  });

  // The full key is returned exactly once — never retrievable again.
  res.status(201).json({ ...result.rows[0], key: fullKey });
}

export async function revokeApiKey(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const id = String(req.params.id);
  const result = await query(
    `UPDATE api_keys SET revoked = true WHERE id = $1 AND org_id = $2 RETURNING id, name`,
    [id, orgId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }
  await recordAudit(req, {
    action: 'apikey.revoke', targetType: 'api_key', targetId: id,
    targetLabel: result.rows[0].name, orgId,
  });
  res.json({ revoked: true });
}

// ── Webhook endpoints ───────────────────────────────────────────────────
export function listEvents(_req: Request, res: Response): void {
  res.json({ events: WEBHOOK_EVENTS });
}

export async function listWebhooks(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const result = await query(
    `SELECT w.id, w.url, w.events, w.active, w.created_at,
            (SELECT json_build_object('success', d.success, 'status_code', d.status_code, 'event', d.event, 'created_at', d.created_at)
               FROM webhook_deliveries d WHERE d.endpoint_id = w.id
               ORDER BY d.created_at DESC LIMIT 1) AS last_delivery
     FROM webhook_endpoints w WHERE w.org_id = $1 ORDER BY w.created_at DESC`,
    [orgId]
  );
  res.json(result.rows);
}

function validUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function sanitiseEvents(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map(String).filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
}

export async function createWebhook(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const url = String(req.body?.url || '').trim();
  if (!validUrl(url)) {
    res.status(400).json({ error: 'Enter a valid https URL.' });
    return;
  }
  const events = sanitiseEvents(req.body?.events);
  const secret = generateWebhookSecret();

  const result = await query(
    `INSERT INTO webhook_endpoints (org_id, url, secret, events)
     VALUES ($1, $2, $3, $4)
     RETURNING id, url, events, active, created_at`,
    [orgId, url, secret, events]
  );
  await recordAudit(req, {
    action: 'webhook.create', targetType: 'webhook', targetId: result.rows[0].id,
    targetLabel: url, orgId,
  });
  // Secret shown once so the partner can verify signatures.
  res.status(201).json({ ...result.rows[0], secret });
}

export async function updateWebhook(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const id = String(req.params.id);
  const fields: string[] = [];
  const params: unknown[] = [id, orgId];

  if (req.body?.url !== undefined) {
    const url = String(req.body.url).trim();
    if (!validUrl(url)) {
      res.status(400).json({ error: 'Enter a valid https URL.' });
      return;
    }
    params.push(url);
    fields.push(`url = $${params.length}`);
  }
  if (req.body?.events !== undefined) {
    params.push(sanitiseEvents(req.body.events));
    fields.push(`events = $${params.length}`);
  }
  if (req.body?.active !== undefined) {
    params.push(Boolean(req.body.active));
    fields.push(`active = $${params.length}`);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'Nothing to update.' });
    return;
  }

  const result = await query(
    `UPDATE webhook_endpoints SET ${fields.join(', ')}
     WHERE id = $1 AND org_id = $2
     RETURNING id, url, events, active, created_at`,
    params as any[]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }
  res.json(result.rows[0]);
}

export async function deleteWebhook(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const id = String(req.params.id);
  const result = await query(
    `DELETE FROM webhook_endpoints WHERE id = $1 AND org_id = $2 RETURNING id, url`,
    [id, orgId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }
  await recordAudit(req, {
    action: 'webhook.delete', targetType: 'webhook', targetId: id,
    targetLabel: result.rows[0].url, orgId,
  });
  res.json({ deleted: true });
}

// POST /developer/webhooks/:id/test — send a signed ping to the endpoint.
export async function testWebhook(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const id = String(req.params.id);
  const result = await query(
    `SELECT id, url, secret, events FROM webhook_endpoints WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }
  const ok = await sendPing(result.rows[0]);
  res.json({ delivered: ok });
}

// GET /developer/webhooks/:id/deliveries — recent attempts, for observability.
export async function listDeliveries(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const id = String(req.params.id);
  const owns = await query('SELECT id FROM webhook_endpoints WHERE id = $1 AND org_id = $2', [id, orgId]);
  if (owns.rows.length === 0) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }
  const result = await query(
    `SELECT id, event, status_code, success, error, created_at
     FROM webhook_deliveries WHERE endpoint_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [id]
  );
  res.json(result.rows);
}
