import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { isSessionActive, touchSession } from '../lib/sessions';

// Per-tenant role. Governs what a user may do with their own organisation's
// data — distinct from is_platform_admin, which governs the platform Admin
// Console. analyst is read-only; manager can mutate members/services but not
// manage users or billing; admin has full control of the tenant.
export type Role = 'admin' | 'manager' | 'analyst';

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: Role;
  // Set when a platform admin is "viewing as" a tenant org: orgId is the tenant
  // they're acting in, userId is still the platform admin (for audit).
  actingAs?: string;
  // Session id (active-device management). Present on tokens issued after the
  // sessions feature shipped; absent on legacy/impersonation tokens (which skip
  // the revocation check).
  sid?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.split(' ')[1];
  let decoded: JwtPayload & { scope?: string };
  try {
    // Pin the algorithm so a token can't dictate a weaker/none alg.
    decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload & { scope?: string };
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Member-portal tokens (scope:'member') must never authenticate a staff
  // session — they carry no userId/role. Reject them on the partner side.
  if (decoded.scope === 'member' || !decoded.userId) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Active-device management: if the token carries a session id, make sure that
  // session hasn't been revoked ("sign out this device" / "sign out everywhere").
  // isSessionActive fails CLOSED (rejects on a revoked/absent session or DB error),
  // except when the sessions table doesn't exist yet. Legacy/impersonation tokens
  // have no sid and skip this entirely.
  if (decoded.sid) {
    if (!(await isSessionActive(decoded.sid))) {
      res.status(401).json({ error: 'This session has been signed out. Please sign in again.' });
      return;
    }
    touchSession(decoded.sid);
  }

  req.user = decoded;
  next();
}

// Route guard: restrict an endpoint to the listed roles. Must run after
// authenticate(). Tokens issued before the role model widened may carry a
// legacy role (e.g. 'member'); those simply fall outside the allow-list and are
// treated as read-only, which is the safe default.
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (allowed.includes(req.user.role)) {
      next();
      return;
    }
    res.status(403).json({ error: 'You do not have permission to perform this action' });
  };
}

// Convenience guard for write/mutation endpoints: admins and managers may
// change data, analysts are read-only.
export const requireWrite = requireRole('admin', 'manager');
