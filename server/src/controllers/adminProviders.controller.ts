import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { passwordIssue } from '../lib/password';
import { recordAudit } from '../lib/audit';

// Platform-admin management of providers (clinicians & pharmacists) who staff the
// partner organisations. Behind authenticate + requirePlatformAdmin (admin.routes).

const ROLES = ['doctor', 'pharmacist'];

export async function adminListProviders(req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT pr.id, pr.partner_id, p.name AS partner_name, p.category AS partner_category,
            pr.full_name, pr.email, pr.role, pr.specialty, pr.photo_url, pr.phone, pr.is_active, pr.created_at
       FROM providers pr JOIN partners p ON pr.partner_id = p.id
      ORDER BY pr.created_at DESC`
  );
  res.json(result.rows);
}

export async function adminCreateProvider(req: Request, res: Response): Promise<void> {
  const { partnerId, fullName, email, password, role = 'doctor', specialty = '', photoUrl = '', phone = '' } = req.body;

  if (!partnerId || !fullName || !email) {
    res.status(400).json({ error: 'partnerId, fullName and email are required' });
    return;
  }
  if (!ROLES.includes(role)) {
    res.status(400).json({ error: 'role must be doctor or pharmacist' });
    return;
  }
  const pwIssue = passwordIssue(password);
  if (pwIssue) {
    res.status(400).json({ error: pwIssue });
    return;
  }
  const partner = await query('SELECT 1 FROM partners WHERE id = $1', [partnerId]);
  if (partner.rows.length === 0) {
    res.status(404).json({ error: 'Partner not found' });
    return;
  }
  const clash = await query('SELECT 1 FROM providers WHERE email = $1', [email]);
  if (clash.rows.length > 0) {
    res.status(409).json({ error: 'A provider with that email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    `INSERT INTO providers (partner_id, full_name, email, password_hash, role, specialty, photo_url, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, partner_id, full_name, email, role, specialty, photo_url, phone, is_active, created_at`,
    [partnerId, fullName, email, passwordHash, role, String(specialty).slice(0, 120), String(photoUrl).slice(0, 500), String(phone).slice(0, 40)]
  );
  const created = result.rows[0];
  await recordAudit(req, {
    action: 'provider.create', targetType: 'provider', targetId: created.id,
    targetLabel: created.email, metadata: { role, partnerId },
  });
  res.status(201).json(created);
}

export async function adminUpdateProvider(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const existing = await query('SELECT * FROM providers WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }
  const cur = existing.rows[0];
  const b = req.body;
  const role = b.role ?? cur.role;
  if (!ROLES.includes(role)) {
    res.status(400).json({ error: 'role must be doctor or pharmacist' });
    return;
  }

  const result = await query(
    `UPDATE providers
        SET partner_id = $2, full_name = $3, role = $4, specialty = $5, photo_url = $6, is_active = $7, phone = $8
      WHERE id = $1
      RETURNING id, partner_id, full_name, email, role, specialty, photo_url, phone, is_active, created_at`,
    [
      id,
      b.partnerId ?? cur.partner_id,
      b.fullName ?? b.full_name ?? cur.full_name,
      role,
      b.specialty ?? cur.specialty,
      b.photoUrl ?? b.photo_url ?? cur.photo_url,
      b.is_active ?? cur.is_active,
      (b.phone ?? cur.phone ?? '').toString().slice(0, 40),
    ]
  );
  await recordAudit(req, {
    action: 'provider.update', targetType: 'provider', targetId: id, targetLabel: cur.email,
  });
  res.json(result.rows[0]);
}

export async function adminResetProviderPassword(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { password } = req.body;
  const pwIssue = passwordIssue(password);
  if (pwIssue) {
    res.status(400).json({ error: pwIssue });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    'UPDATE providers SET password_hash = $2 WHERE id = $1 RETURNING id, email',
    [id, passwordHash]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }
  await recordAudit(req, {
    action: 'provider.reset_password', targetType: 'provider', targetId: id, targetLabel: result.rows[0].email,
  });
  res.json({ reset: true });
}

export async function adminDeleteProvider(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const result = await query('DELETE FROM providers WHERE id = $1 RETURNING id, email', [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }
  await recordAudit(req, {
    action: 'provider.delete', targetType: 'provider', targetId: id, targetLabel: result.rows[0].email,
  });
  res.json({ deleted: true });
}
