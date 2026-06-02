import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';

// Resolves whether a user may manage the platform-wide catalog (partners +
// insurance plans). A user qualifies if their users.is_platform_admin flag is
// set, OR their email is in the PLATFORM_ADMIN_EMAILS allowlist — the latter is
// a zero-DB bootstrap so the first admin can be granted access via env alone.
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const result = await query(
    'SELECT email, is_platform_admin FROM users WHERE id = $1',
    [userId]
  );
  if (result.rows.length === 0) return false;
  const row = result.rows[0];
  if (row.is_platform_admin) return true;
  return env.platformAdminEmails.includes(String(row.email).toLowerCase());
}

// Route guard: must run after authenticate(). Wrap with asyncHandler in routes
// so a rejected DB lookup is forwarded to the error handler, not swallowed.
export async function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (await isPlatformAdmin(req.user.userId)) {
    next();
    return;
  }
  res.status(403).json({ error: 'Platform admin access required' });
}
