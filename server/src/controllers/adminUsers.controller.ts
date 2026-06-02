import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';

// Platform-admin management of the dashboard users that belong to partner
// organisations. Behind authenticate + requirePlatformAdmin (see admin.routes.ts).

export async function adminListUsers(req: Request, res: Response): Promise<void> {
  // Optional ?orgId=… filter to scope the list to a single organisation.
  const { orgId } = req.query;
  const params: string[] = [];
  let where = '';
  if (orgId) {
    params.push(String(orgId));
    where = 'WHERE u.org_id = $1';
  }
  const result = await query(
    `SELECT u.id, u.org_id, u.email, u.full_name, u.role, u.is_active,
            u.is_platform_admin, u.created_at, o.name AS org_name
       FROM users u JOIN organisations o ON u.org_id = o.id
       ${where}
      ORDER BY u.created_at DESC`,
    params
  );
  res.json(result.rows);
}

export async function adminCreateUser(req: Request, res: Response): Promise<void> {
  const {
    orgId, email, password, fullName, role = 'admin', isPlatformAdmin = false,
  } = req.body;

  if (!orgId || !email || !fullName) {
    res.status(400).json({ error: 'orgId, email and fullName are required' });
    return;
  }
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const org = await query('SELECT 1 FROM organisations WHERE id = $1', [orgId]);
  if (org.rows.length === 0) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }

  const clash = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (clash.rows.length > 0) {
    res.status(409).json({ error: 'A user with that email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    `INSERT INTO users (org_id, email, password_hash, full_name, role, is_platform_admin)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, org_id, email, full_name, role, is_active, is_platform_admin, created_at`,
    [orgId, email, passwordHash, fullName, role, Boolean(isPlatformAdmin)]
  );
  res.status(201).json(result.rows[0]);
}

export async function adminUpdateUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const existing = await query('SELECT * FROM users WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const cur = existing.rows[0];
  const b = req.body;
  const isSelf = id === req.user!.userId;

  // Guard against self-lockout: an admin can't deactivate themselves or strip
  // away their own platform-admin access (which would lock them out of here).
  if (isSelf && b.is_active === false) {
    res.status(400).json({ error: 'You cannot deactivate your own account' });
    return;
  }
  if (isSelf && b.is_platform_admin === false) {
    res.status(400).json({ error: 'You cannot remove your own platform-admin access' });
    return;
  }

  const result = await query(
    `UPDATE users
        SET full_name = $2, role = $3, is_active = $4, is_platform_admin = $5,
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, org_id, email, full_name, role, is_active, is_platform_admin, created_at`,
    [
      id,
      b.full_name ?? b.fullName ?? cur.full_name,
      b.role ?? cur.role,
      b.is_active ?? cur.is_active,
      b.is_platform_admin ?? cur.is_platform_admin,
    ]
  );
  res.json(result.rows[0]);
}

export async function adminResetUserPassword(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING id',
    [id, passwordHash]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ reset: true });
}

export async function adminDeleteUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (id === req.user!.userId) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }
  const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ deleted: true });
}
