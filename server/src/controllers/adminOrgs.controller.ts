import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { generateJoinCode, uniqueSlug } from '../lib/org';
import { passwordIssue } from '../lib/password';
import { randomPlaceholderSecret } from '../lib/invites';
import { sendAdminWelcome } from '../lib/onboarding';
import { recordAudit } from '../lib/audit';
import { geocode } from '../lib/geo';
import { getOrgBranding } from '../lib/branding';

// Platform-admin management of partner organisations (tenants). Behind
// authenticate + requirePlatformAdmin (see admin.routes.ts).

export async function adminListOrgs(_req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT o.id, o.name, o.slug, o.type, o.country, o.plan_tier,
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
    name, type = 'company', planTier = 'starter', country = 'Nigeria',
    adminEmail, adminPassword, adminFullName,
  } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Organisation name is required' });
    return;
  }

  // If provisioning an admin alongside the org, validate before creating anything.
  // Password is OPTIONAL: omit it to send a "set your password" activation email
  // instead of setting/sharing a password manually.
  if (adminEmail) {
    if (adminPassword) {
      const pwIssue = passwordIssue(adminPassword);
      if (pwIssue) {
        res.status(400).json({ error: `Admin ${pwIssue.charAt(0).toLowerCase()}${pwIssue.slice(1)}` });
        return;
      }
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
    `INSERT INTO organisations (name, slug, type, plan_tier, country, join_code)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, slug, type, planTier, country, joinCode]
  );
  const org = orgResult.rows[0];

  let adminUser = null;
  if (adminEmail) {
    const needsActivation = !adminPassword;
    const passwordHash = await bcrypt.hash(adminPassword || randomPlaceholderSecret(), 12);
    const userResult = await query(
      `INSERT INTO users (org_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'admin')
       RETURNING id, email, full_name, role`,
      [org.id, adminEmail, passwordHash, adminFullName || 'Admin']
    );
    adminUser = userResult.rows[0];
    // Best-effort welcome email (activation link if no password was set).
    await sendAdminWelcome({
      userId: adminUser.id, email: adminEmail, fullName: adminFullName || 'Admin',
      orgName: org.name, orgSlug: org.slug, needsActivation,
    });
  }

  await recordAudit(req, {
    action: 'org.create',
    targetType: 'organisation',
    targetId: org.id,
    targetLabel: org.name,
    orgId: org.id,
    metadata: { type, planTier, provisionedAdmin: Boolean(adminUser) },
  });

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

  // Location (used to route prescriptions to the nearest pharmacy). Geocode when
  // the address/city changes and a geocoding key is configured.
  const address = b.address !== undefined ? String(b.address).slice(0, 500) : cur.address;
  const city = b.city !== undefined ? String(b.city).slice(0, 120) : cur.city;
  let lat = cur.latitude;
  let lng = cur.longitude;
  if ((b.address !== undefined || b.city !== undefined) && (address || city)) {
    const coords = await geocode([address, city].filter(Boolean).join(', '));
    if (coords) { lat = coords.lat; lng = coords.lng; }
  }

  const result = await query(
    `UPDATE organisations
        SET name = $2, type = $3, plan_tier = $4, country = $5, is_active = $6,
            address = $7, city = $8, latitude = $9, longitude = $10,
            updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [
      id,
      b.name ?? cur.name,
      b.type ?? cur.type,
      b.plan_tier ?? cur.plan_tier,
      b.country ?? cur.country,
      b.is_active ?? cur.is_active,
      address, city, lat, lng,
    ]
  );
  const updated = result.rows[0];

  // Distinguish suspend/reactivate from a plain edit for a clearer trail.
  let action = 'org.update';
  if (b.is_active === false && cur.is_active !== false) action = 'org.suspend';
  else if (b.is_active === true && cur.is_active === false) action = 'org.reactivate';
  await recordAudit(req, {
    action,
    targetType: 'organisation',
    targetId: updated.id,
    targetLabel: updated.name,
    orgId: updated.id,
  });

  res.json(updated);
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

  const existing = await query('SELECT name FROM organisations WHERE id = $1', [id]);
  const result = await query('DELETE FROM organisations WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }
  await recordAudit(req, {
    action: 'org.delete',
    targetType: 'organisation',
    targetId: id,
    targetLabel: existing.rows[0]?.name,
    orgId: id,
  });
  res.json({ deleted: true });
}

// ── Per-tenant branding (platform admin) ────────────────────────────────────
// Lets the platform team white-label a tenant during onboarding without needing
// that org's own login. Mirrors the self-service /settings/branding fields.
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function hex(v: unknown, fallback: string): string {
  const s = String(v ?? '').trim();
  return HEX.test(s) ? s : fallback;
}

// GET /admin/organisations/:id/branding
export async function adminGetOrgBranding(req: Request, res: Response): Promise<void> {
  res.json(await getOrgBranding(String(req.params.id)));
}

// PUT /admin/organisations/:id/branding
export async function adminUpdateOrgBranding(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const org = await query('SELECT name FROM organisations WHERE id = $1', [id]);
  if (org.rows.length === 0) { res.status(404).json({ error: 'Organisation not found' }); return; }

  const cur = await getOrgBranding(id);
  const displayName = String(req.body?.displayName ?? cur.displayName).slice(0, 120);
  const logoLetter = String(req.body?.logoLetter ?? cur.logoLetter).slice(0, 4);
  const primary = hex(req.body?.primaryColor, cur.primaryColor);
  const accent = hex(req.body?.accentColor, cur.accentColor);
  const support = String(req.body?.supportContact ?? cur.supportContact).slice(0, 160);
  const greeting = String(req.body?.whatsappGreeting ?? cur.whatsappGreeting).slice(0, 1000);

  await query(
    `INSERT INTO org_branding
       (org_id, display_name, logo_letter, primary_color, accent_color, support_contact, whatsapp_greeting, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (org_id) DO UPDATE SET
       display_name = $2, logo_letter = $3, primary_color = $4, accent_color = $5,
       support_contact = $6, whatsapp_greeting = $7, updated_at = NOW()`,
    [id, displayName, logoLetter, primary, accent, support, greeting]
  );
  await recordAudit(req, { action: 'branding.update', targetType: 'organisation', targetId: id, targetLabel: org.rows[0].name, orgId: id });
  res.json(await getOrgBranding(id));
}
