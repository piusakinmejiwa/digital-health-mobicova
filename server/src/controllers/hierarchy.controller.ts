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

// ── Plan assignments ────────────────────────────────────────────────────────
// Confirm `employerId` is an employer directly beneath the calling org.
async function childEmployer(callerId: string, employerId: string): Promise<boolean> {
  const r = await query('SELECT 1 FROM organisations WHERE id = $1 AND parent_org_id = $2', [employerId, callerId]);
  return r.rows.length > 0;
}

// GET /hierarchy/plans — the plans this HMO/insurer can assign (ones it offers or
// underwrites), for the assignment picker.
export async function listAssignablePlans(req: Request, res: Response): Promise<void> {
  const callerId = req.user!.orgId;
  const r = await query(
    `SELECT id, name, plan_type, kind, monthly_premium, currency
       FROM insurance_plans
      WHERE is_active = true AND (offered_by_org_id = $1 OR underwriter_org_id = $1)
      ORDER BY name`,
    [callerId]
  );
  res.json(r.rows);
}

// GET /hierarchy/employers/:id/plans — plans assigned to a child employer.
export async function listEmployerAssignments(req: Request, res: Response): Promise<void> {
  const callerId = req.user!.orgId;
  const employerId = String(req.params.id);
  if (!(await childEmployer(callerId, employerId))) { res.status(404).json({ error: 'Employer not found' }); return; }

  const r = await query(
    `SELECT a.id, a.plan_id, a.negotiated_premium, a.status, a.created_at,
            pl.name AS plan_name, pl.kind, pl.monthly_premium AS list_premium, pl.currency,
            COALESCE(a.negotiated_premium, pl.monthly_premium) AS effective_premium
       FROM plan_assignments a
       JOIN insurance_plans pl ON pl.id = a.plan_id
      WHERE a.employer_org_id = $1
      ORDER BY a.created_at DESC`,
    [employerId]
  );
  res.json(r.rows);
}

// POST /hierarchy/employers/:id/plans — assign a plan (optionally at a negotiated
// premium) to a child employer. Idempotent per (employer, plan).
export async function assignPlan(req: Request, res: Response): Promise<void> {
  const callerId = req.user!.orgId;
  const employerId = String(req.params.id);
  const planId = String(req.body?.planId || '');
  const rawPremium = req.body?.negotiatedPremium;
  const negotiated = rawPremium === '' || rawPremium == null ? null : Number(rawPremium);

  if (!planId) { res.status(400).json({ error: 'planId is required' }); return; }
  if (negotiated !== null && (!Number.isFinite(negotiated) || negotiated < 0)) {
    res.status(400).json({ error: 'Negotiated premium must be a non-negative number.' }); return;
  }
  if (!(await childEmployer(callerId, employerId))) { res.status(404).json({ error: 'Employer not found' }); return; }

  // The plan must be one this org actually offers or underwrites.
  const plan = await query(
    'SELECT id, name FROM insurance_plans WHERE id = $1 AND is_active = true AND (offered_by_org_id = $2 OR underwriter_org_id = $2)',
    [planId, callerId]
  );
  if (plan.rows.length === 0) { res.status(400).json({ error: 'That plan is not offered or underwritten by your organisation.' }); return; }

  const r = await query(
    `INSERT INTO plan_assignments (employer_org_id, plan_id, assigned_by_org_id, negotiated_premium, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (employer_org_id, plan_id)
       DO UPDATE SET negotiated_premium = EXCLUDED.negotiated_premium, status = 'active'
     RETURNING *`,
    [employerId, planId, callerId, negotiated]
  );
  await recordAudit(req, {
    action: 'plan.assign', targetType: 'organisation', targetId: employerId,
    targetLabel: plan.rows[0].name, orgId: callerId, metadata: { planId, negotiatedPremium: negotiated },
  });
  res.status(201).json(r.rows[0]);
}

// DELETE /hierarchy/employers/:id/plans/:assignmentId — remove an assignment.
export async function unassignPlan(req: Request, res: Response): Promise<void> {
  const callerId = req.user!.orgId;
  const employerId = String(req.params.id);
  const assignmentId = String(req.params.assignmentId);
  if (!(await childEmployer(callerId, employerId))) { res.status(404).json({ error: 'Employer not found' }); return; }

  const r = await query(
    'DELETE FROM plan_assignments WHERE id = $1 AND employer_org_id = $2 RETURNING id',
    [assignmentId, employerId]
  );
  if (r.rows.length === 0) { res.status(404).json({ error: 'Assignment not found' }); return; }
  await recordAudit(req, { action: 'plan.unassign', targetType: 'organisation', targetId: employerId, orgId: callerId, metadata: { assignmentId } });
  res.json({ removed: true });
}
