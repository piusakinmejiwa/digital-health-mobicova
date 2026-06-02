import { Request, Response, NextFunction } from 'express';
import { verifyProviderToken, ProviderJwtPayload, ProviderRole } from '../lib/providerAuth';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      provider?: ProviderJwtPayload;
    }
  }
}

// Guards the provider-portal routes. Accepts only provider-scoped tokens.
export function authenticateProvider(req: Request, res: Response, next: NextFunction): void {
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
