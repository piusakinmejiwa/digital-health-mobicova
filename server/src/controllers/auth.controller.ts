import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { env } from '../config/env';
import { JwtPayload } from '../middleware/auth';
import { isPlatformAdmin } from '../middleware/platformAdmin';
import { generateJoinCode } from '../lib/org';

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, fullName, orgName, partnerType } = req.body;

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const slugExists = await query('SELECT id FROM organisations WHERE slug = $1', [slug]);
  if (slugExists.rows.length > 0) {
    res.status(409).json({ error: 'Organisation name already taken' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const joinCode = await generateJoinCode();
  const orgResult = await query(
    `INSERT INTO organisations (name, slug, partner_type, join_code) VALUES ($1, $2, $3, $4) RETURNING id`,
    [orgName, slug, partnerType || 'employer', joinCode]
  );
  const orgId = orgResult.rows[0].id;

  const userResult = await query(
    `INSERT INTO users (org_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, 'admin') RETURNING id`,
    [orgId, email, passwordHash, fullName]
  );

  const payload: JwtPayload = { userId: userResult.rows[0].id, orgId, role: 'admin' };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });

  res.status(201).json({
    token,
    user: { id: userResult.rows[0].id, email, fullName, role: 'admin', orgId, orgName, partnerType: partnerType || 'employer' },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  const result = await query(
    `SELECT u.id, u.org_id, u.email, u.password_hash, u.full_name, u.role,
            o.name as org_name, o.partner_type, o.is_active AS org_active
     FROM users u JOIN organisations o ON u.org_id = o.id
     WHERE u.email = $1 AND u.is_active = true`,
    [email]
  );

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // A suspended organisation blocks all of its users from signing in.
  if (result.rows[0].org_active === false) {
    res.status(403).json({ error: 'This organisation is suspended. Contact MobiCova support.' });
    return;
  }

  const user = result.rows[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const payload: JwtPayload = { userId: user.id, orgId: user.org_id, role: user.role };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      orgId: user.org_id,
      orgName: user.org_name,
      partnerType: user.partner_type,
    },
  });
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.org_id,
            o.name as org_name, o.partner_type, o.plan_tier, o.join_code
     FROM users u JOIN organisations o ON u.org_id = o.id
     WHERE u.id = $1`,
    [req.user.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const user = result.rows[0];
  res.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    orgId: user.org_id,
    orgName: user.org_name,
    partnerType: user.partner_type,
    planTier: user.plan_tier,
    joinCode: user.join_code,
    isPlatformAdmin: await isPlatformAdmin(req.user.userId),
  });
}
