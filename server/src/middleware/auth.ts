import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// Per-tenant role. Governs what a user may do with their own organisation's
// data — distinct from is_platform_admin, which governs the platform Admin
// Console. analyst is read-only; manager can mutate members/services but not
// manage users or billing; admin has full control of the tenant.
export type Role = 'admin' | 'manager' | 'analyst';

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload & { scope?: string };
    // Member-portal tokens (scope:'member') must never authenticate a staff
    // session — they carry no userId/role. Reject them on the partner side.
    if (decoded.scope === 'member' || !decoded.userId) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
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
