import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { hashApiKey, apiKeyPrefix, hashesEqual } from '../lib/apiKeys';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiOrgId?: string;
      apiKeyId?: string;
    }
  }
}

// Authenticates a public-API request with a partner's API key. Accepts the key
// in `Authorization: Bearer mk_live_…` or in the `X-API-Key` header. Resolves the
// owning organisation and pins the request to it, so every public endpoint is
// automatically tenant-scoped.
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const fromBearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const fromHeader = (req.headers['x-api-key'] as string | undefined)?.trim() || '';
  const key = fromBearer || fromHeader;

  if (!key || !key.startsWith('mk_')) {
    res.status(401).json({ error: 'Missing or malformed API key' });
    return;
  }

  const candidateHash = hashApiKey(key);
  const result = await query(
    `SELECT id, org_id, key_hash FROM api_keys
     WHERE key_prefix = $1 AND revoked = false`,
    [apiKeyPrefix(key)]
  );

  const match = result.rows.find((row) => hashesEqual(row.key_hash, candidateHash));
  if (!match) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  req.apiOrgId = match.org_id;
  req.apiKeyId = match.id;
  // Best-effort last-used stamp; never block the request on it.
  query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [match.id]).catch(() => {});
  next();
}
