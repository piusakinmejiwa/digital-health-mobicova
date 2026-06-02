import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { generateJoinCode, uniqueSlug } from '../lib/org';

// Platform-admin management of partner organisations (tenants). Behind
// authenticate + requirePlatformAdmin (see admin.routes.ts).

export async function adminListOrgs(_req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT o.id, o.name, o.slug, o.partner_type, o.country, o.plan_tier,
            o.join_code, o.is_active, o.created_at,
            (SELECT COUNT(*)::int FROM members m WHERE m.org_id = o.id) AS member_count,
            (SELECT COUNT(*)::int FROM users u WHERE u.org_id = o.id) AS user_count
       FROM organisations o
      ORDER BY o.created_at DESC`
  );
  res.json(result.rows);
}

// Creates an organisation and, optionally, its first admin user in one step —
// the live-onboarding flow. Slug and join code are generated automatically.
export async function adminCreateOrg(req: Request, res: Response): Promise<void> {
  const {
    name, partnerType = 'employer', planTier = 'starter', country = 'Nigeria',
    adminEmail, adminPassword, adminFullName,
  } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Organisation name is required' });
    return;
  }

  // If provisioning an admin alongside the org, validate before creating anything.
  if (adminEmail) {
    if (!adminPassword || String(adminPassword).length < 8) {
      res.status(400).json({ error: 'Admin password must be at least 8 characters' });
      return;
    }
    const clash = await query('SELECT 1 FROM users WHERE email = $1', [adminEmail]);
    if (clash.rows.length > 0) {
      res.status(409).json({ error: 'A user with that email already exists' });
      return;
    }
  }

  const slug = await uniqueSlug(name);
  const joinCode = await generateJoinCode();
  const orgResult = await query(
    `INSERT INTO organisations (name, slug, partner_type, plan_tier, country, join_code)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, slug, partnerType, planTier, country, joinCode]
  );
  const org = orgResult.rows[0];

  let adminUser = null;
  if (adminEmail) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const userResult = await query(
      `INSERT INTO users (org_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'admin')
       RETURNING id, email, full_name, role`,
      [org.id, adminEmail, passwordHash, adminFullName || 'Admin']
    );
    adminUser = userResult.rows[0];
  }

  res.status(201).json({
    ...org,
    member_count: 0,
    user_count: adminUser ? 1 : 0,
    admin_user: adminUser,
  });
}

export async function adminUpdateOrg(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const existing = await query('SELECT * FROM organisations WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }
  const cur = existing.rows[0];
  const b = req.body;

  // Don't let an admin suspend the org they themselves belong to (self-lockout).
  if (b.is_active === false && id === req.user!.orgId) {
    res.status(400).json({ error: 'You cannot suspend your own organisation' });
    return;
  }

  const result = await query(
    `UPDATE organisations
        SET name = $2, partner_type = $3, plan_tier = $4, country = $5, is_active = $6,
            updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [
      id,
      b.name ?? cur.name,
      b.partner_type ?? cur.partner_type,
      b.plan_tier ?? cur.plan_tier,
      b.country ?? cur.country,
      b.is_active ?? cur.is_active,
    ]
  );
  res.json(result.rows[0]);
}

export async function adminDeleteOrg(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (id === req.user!.orgId) {
    res.status(400).json({ error: 'You cannot delete your own organisation' });
    return;
  }

  // Deleting an org cascades to its users, members and enrolments. Guard against
  // accidental data loss: only allow deleting an org with no members.
  const members = await query('SELECT 1 FROM members WHERE org_id = $1 LIMIT 1', [id]);
  if (members.rows.length > 0) {
    res.status(409).json({
      error: 'This organisation has members and cannot be deleted. Suspend it instead.',
    });
    return;
  }

  const result = await query('DELETE FROM organisations WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }
  res.json({ deleted: true });
}
