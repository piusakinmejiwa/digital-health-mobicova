import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { generateJoinCode, uniqueSlug } from '../lib/org';
import { passwordIssue } from '../lib/password';
import { randomPlaceholderSecret } from '../lib/invites';
import { sendAdminWelcome } from '../lib/onboarding';
import { recordAudit } from '../lib/audit';

// The HMO / insurer onboarding console. An HMO (or insurer) admin manages the
// EMPLOYER organisations that sit beneath it in the hierarchy (parent_org_id =
// the caller). Gated to those org types by requireOrgType in the route.

// GET /hierarchy/employers — the employers this org has onboarded.
export async function listChildEmployers(req: Request, res: Response): Promise<void> {
  const parentId = req.user!.orgId;
  const r = await query(
    `SELECT o.id, o.name, o.slug, o.type, o.join_code, o.is_active, o.created_at,
            (SELECT COUNT(*)::int FROM members m WHERE m.org_id = o.id) AS member_count,
            (SELECT COUNT(*)::int FROM users u WHERE u.org_id = o.id) AS user_count
       FROM organisations o
      WHERE o.parent_org_id = $1
      ORDER BY o.created_at DESC`,
    [parentId]
  );
  res.json(r.rows);
}

// POST /hierarchy/employers — onboard a new employer under this org. Creates a
// `company` org with parent_org_id = the caller, and (optionally) its first admin.
export async function createChildEmployer(req: Request, res: Response): Promise<void> {
  const parentId = req.user!.orgId;
  const name = String(req.body?.name || '').trim();
  const adminEmail = String(req.body?.adminEmail || '').trim();
  const adminFullName = String(req.body?.adminFullName || '').trim();
  const adminPassword = String(req.body?.adminPassword || '');

  if (!name) { res.status(400).json({ error: 'Employer name is required' }); return; }

  if (adminEmail) {
    if (adminPassword) {
      const pw = passwordIssue(adminPassword);
      if (pw) { res.status(400).json({ error: `Admin ${pw.charAt(0).toLowerCase()}${pw.slice(1)}` }); return; }
    }
    const clash = await query('SELECT 1 FROM users WHERE email = $1', [adminEmail]);
    if (clash.rows.length > 0) { res.status(409).json({ error: 'A user with that email already exists' }); return; }
  }

  const slug = await uniqueSlug(name);
  const joinCode = await generateJoinCode();
  const orgRes = await query(
    `INSERT INTO organisations (name, slug, type, plan_tier, country, join_code, parent_org_id)
     VALUES ($1, $2, 'company', 'starter', 'Nigeria', $3, $4) RETURNING *`,
    [name, slug, joinCode, parentId]
  );
  const org = orgRes.rows[0];

  let adminUser = null;
  if (adminEmail) {
    const needsActivation = !adminPassword;
    const hash = await bcrypt.hash(adminPassword || randomPlaceholderSecret(), 12);
    const u = await query(
      `INSERT INTO users (org_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'admin')
       RETURNING id, email, full_name, role`,
      [org.id, adminEmail, hash, adminFullName || 'Admin']
    );
    adminUser = u.rows[0];
    await sendAdminWelcome({
      userId: adminUser.id, email: adminEmail, fullName: adminFullName || 'Admin',
      orgName: org.name, orgSlug: org.slug, needsActivation,
    });
  }

  await recordAudit(req, {
    action: 'org.child.create', targetType: 'organisation', targetId: org.id,
    targetLabel: org.name, orgId: parentId, metadata: { parentId, provisionedAdmin: Boolean(adminUser) },
  });

  res.status(201).json({ ...org, member_count: 0, user_count: adminUser ? 1 : 0, admin_user: adminUser });
}
