import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { hashApiKey, hashesEqual } from '../lib/apiKeys';
import { distKeyPrefix } from '../lib/distribution';

export interface DistributionPartnerCtx {
  id: string;
  orgId: string;
  name: string;
  sandbox: boolean;
  commissionRate: number;
  platformFeeRate: number;
  webhookUrl: string;
  webhookSecret: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      distributionPartner?: DistributionPartnerCtx;
    }
  }
}

// Authenticates a Partner Distribution API request with a mk_dist_… key
// (Authorization: Bearer, or X-API-Key). Resolves the partner + the underwriter
// org whose plans it distributes, and pins the request to it. Prefix-narrowed
// lookup, then constant-time hash compare — same scheme as apiKeyAuth.
export async function authenticateDistributionPartner(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const fromBearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const fromHeader = (req.headers['x-api-key'] as string | undefined)?.trim() || '';
  const key = fromBearer || fromHeader;

  if (!key || !key.startsWith('mk_dist_')) {
    res.status(401).json({ error: 'Missing or malformed distribution key' });
    return;
  }

  const candidateHash = hashApiKey(key);
  const result = await query(
    `SELECT id, org_id, name, key_hash, sandbox, commission_rate, platform_fee_rate, webhook_url, webhook_secret
       FROM distribution_partners
      WHERE key_prefix = $1 AND active = true`,
    [distKeyPrefix(key)]
  );
  const match = result.rows.find((row) => row.key_hash && hashesEqual(row.key_hash, candidateHash));
  if (!match) {
    res.status(401).json({ error: 'Invalid distribution key' });
    return;
  }

  req.distributionPartner = {
    id: match.id,
    orgId: match.org_id,
    name: match.name,
    sandbox: match.sandbox,
    commissionRate: Number(match.commission_rate),
    platformFeeRate: Number(match.platform_fee_rate),
    webhookUrl: match.webhook_url || '',
    webhookSecret: match.webhook_secret || '',
  };
  query('UPDATE distribution_partners SET last_used_at = NOW() WHERE id = $1', [match.id]).catch(() => {});
  next();
}
