import { Request, Response } from 'express';
import { query } from '../config/database';
import { recordAudit } from '../lib/audit';
import { generateDistributionKey, generatePartnerWebhookSecret } from '../lib/distribution';
import { emitPlatformSlack } from '../lib/slack';

// Platform-admin provisioning for distribution partners (PalmPay, OPay, …).
// Lives behind the /admin router (authenticate + requirePlatformAdmin). The API
// key + webhook secret are returned ONCE at creation/rotation and only the hash
// is stored — same handling as public API keys.

// GET /admin/distribution-partners — list (never returns key hashes/secrets).
export async function listDistributionPartners(_req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT dp.id, dp.name, dp.slug, dp.key_prefix, dp.webhook_url, dp.commission_rate,
            dp.platform_fee_rate, dp.sandbox, dp.active, dp.created_at, dp.last_used_at,
            o.name AS org_name, dp.org_id
       FROM distribution_partners dp JOIN organisations o ON o.id = dp.org_id
      ORDER BY dp.created_at DESC`
  );
  res.json({ partners: r.rows });
}

// POST /admin/distribution-partners { orgId, name, slug, webhookUrl?, commissionRate?, sandbox? }
export async function createDistributionPartner(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const orgId = String(b.orgId || '');
  const name = String(b.name || '').trim();
  const slug = String(b.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!orgId || !name || !slug) { res.status(400).json({ error: 'orgId, name and slug are required' }); return; }

  const org = await query('SELECT id FROM organisations WHERE id = $1', [orgId]);
  if (org.rows.length === 0) { res.status(404).json({ error: 'Organisation not found' }); return; }

  const key = generateDistributionKey();
  const webhookSecret = generatePartnerWebhookSecret();
  const r = await query(
    `INSERT INTO distribution_partners
        (org_id, name, slug, key_prefix, key_hash, webhook_url, webhook_secret, commission_rate, platform_fee_rate, sandbox)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [orgId, name, slug, key.prefix, key.hash, String(b.webhookUrl || ''), webhookSecret,
     Number(b.commissionRate) || 0, Number(b.platformFeeRate) || 0, b.sandbox !== false]
  );
  await recordAudit(req, {
    action: 'distribution_partner.create', orgId, targetType: 'distribution_partner',
    targetId: r.rows[0].id, targetLabel: name,
  });
  emitPlatformSlack(`:electric_plug: Distribution partner signed up: *${name}*${b.sandbox !== false ? ' (sandbox)' : ' (live)'}`);
  // apiKey + webhookSecret are shown ONCE — the partner stores them; we keep only the hash.
  res.status(201).json({
    id: r.rows[0].id, name, slug, sandbox: b.sandbox !== false,
    apiKey: key.fullKey, webhookSecret,
    note: 'Store the apiKey and webhookSecret now — they are not shown again.',
  });
}

// POST /admin/distribution-partners/:id/rotate-key — issue a new API key.
export async function rotateDistributionKey(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const key = generateDistributionKey();
  const r = await query(
    `UPDATE distribution_partners SET key_prefix = $2, key_hash = $3 WHERE id = $1 RETURNING name, org_id`,
    [id, key.prefix, key.hash]
  );
  if (r.rows.length === 0) { res.status(404).json({ error: 'Distribution partner not found' }); return; }
  await recordAudit(req, {
    action: 'distribution_partner.rotate_key', orgId: r.rows[0].org_id,
    targetType: 'distribution_partner', targetId: id, targetLabel: r.rows[0].name,
  });
  res.json({ id, apiKey: key.fullKey, note: 'The previous key is now invalid.' });
}

// PATCH /admin/distribution-partners/:id { active?, sandbox?, webhookUrl?, commissionRate? }
export async function updateDistributionPartner(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const b = req.body || {};
  const r = await query(
    `UPDATE distribution_partners SET
        active            = COALESCE($2, active),
        sandbox           = COALESCE($3, sandbox),
        webhook_url       = COALESCE($4, webhook_url),
        commission_rate   = COALESCE($5, commission_rate),
        platform_fee_rate = COALESCE($6, platform_fee_rate)
      WHERE id = $1
      RETURNING id, name, slug, sandbox, active, webhook_url, commission_rate, platform_fee_rate`,
    [id, b.active ?? null, b.sandbox ?? null, b.webhookUrl ?? null, b.commissionRate ?? null, b.platformFeeRate ?? null]
  );
  if (r.rows.length === 0) { res.status(404).json({ error: 'Distribution partner not found' }); return; }
  res.json(r.rows[0]);
}

// GET /admin/distribution-partners/:id/premiums[?period=YYYY-MM]
// Ledger roll-up per billing period: gross, commission, MobiCova fee, net to underwriter.
export async function distributionPartnerPremiums(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const period = String(req.query.period || '').trim();
  const params: unknown[] = [id];
  let where = 'partner_id = $1';
  if (period) { params.push(period); where += ' AND period = $2'; }
  const r = await query(
    `SELECT period,
            COUNT(*)::int AS transactions,
            COALESCE(SUM(gross_amount), 0)        AS gross,
            COALESCE(SUM(commission_amount), 0)   AS commission,
            COALESCE(SUM(platform_fee_amount), 0) AS platform_fee,
            COALESCE(SUM(levy_amount), 0)         AS levy,
            COALESCE(SUM(hmo_margin_amount), 0)   AS hmo_margin,
            COALESCE(SUM(net_amount), 0)          AS net_to_underwriter
       FROM premium_transactions
      WHERE ${where} AND type = 'premium'
      GROUP BY period ORDER BY period DESC`,
    params
  );
  res.json({ summary: r.rows });
}
