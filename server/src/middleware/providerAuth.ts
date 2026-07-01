import { Request, Response, NextFunction } from 'express';
import { verifyProviderToken, ProviderJwtPayload, ProviderRole, getProviderSessionEpoch } from '../lib/providerAuth';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      provider?: ProviderJwtPayload;
    }
  }
}

// Guards the provider-portal routes. Accepts only provider-scoped tokens.
export async function authenticateProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sign in to continue' });
    return;
  }
  const payload = verifyProviderToken(header.split(' ')[1]);
  if (!payload) {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }

  // Revocation check (see authenticateMember). Legacy tokens = epoch 0; fails OPEN
  // on DB/column error so it's safe before migration 066 and during DB blips.
  try {
    const epoch = await getProviderSessionEpoch(payload.providerId);
    if (epoch === null) {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      return;
    }
    if ((payload.ep ?? 0) !== epoch) {
      res.status(401).json({ error: 'You have been signed out. Please sign in again.' });
      return;
    }
  } catch {
    /* DB/column unavailable — don't lock providers out; best-effort revocation */
  }

  req.provider = payload;
  next();
}

// Restrict an endpoint to a provider role (doctor vs pharmacist). Runs after
// authenticateProvider.
export function requireProviderRole(role: ProviderRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.provider?.role !== role) {
      res.status(403).json({ error: 'You do not have access to this area.' });
      return;
    }
    next();
  };
}
