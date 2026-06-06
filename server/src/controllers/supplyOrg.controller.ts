import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { orgClass } from '../lib/orgTypes';
import { passwordIssue } from '../lib/password';
import { recordAudit } from '../lib/audit';
import { CLINIC_MEMBER_FIELDS, PHARMACY_MEMBER_FIELDS } from '../lib/memberProjection';

// Endpoints for a SUPPLY-side organisation's ADMIN (a `users` row scoped to a
// clinic/pharmacy org). All reads are scoped to req.user.orgId and use the
// member-care privacy slice. Mounted behind authenticate + requireOrgClass('supply').

async function orgInfo(orgId: string): Promise<{ id: string; name: string; type: string } | null> {
  const r = await query('SELECT id, name, type FROM organisations WHERE id = $1', [orgId]);
  return r.rows[0] || null;
}

// GET /supply/overview — headline counts for the supply-org dashboard.
export async function getSupplyOverview(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const org = await orgInfo(orgId);
  if (!org) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }

  let queueCount = 0;
  if (org.type === 'pharmacy') {
    queueCount = (await query(
      `SELECT COUNT(*)::int AS n FROM prescriptions
        WHERE pharmacy_org_id = $1 AND fulfilment_status NOT IN ('collected', 'delivered')`,
      [orgId]
    )).rows[0].n;
  } else {
    queueCount = (await query(
      `SELECT COUNT(*)::int AS n FROM consultations
        WHERE provider_org_id = $1 AND status IN ('scheduled', 'in_progress')`,
      [orgId]
    )).rows[0].n;
  }
  const staffCount = (await query(
    `SELECT COUNT(*)::int AS n FROM provider_organisations WHERE org_id = $1`,
    [orgId]
  )).rows[0].n;

  res.json({ id: org.id, name: org.name, type: org.type, class: orgClass(org.type), queueCount, staffCount });
}

// GET /supply/queue — the work routed to this org (member-care privacy slice).
//   pharmacy → prescriptions; clinic/diagnostics → consultations.
export async function getSupplyQueue(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const org = await orgInfo(orgId);
  if (!org) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }

  if (org.type === 'pharmacy') {
    const rows = (await query(
      `SELECT rx.id, ${PHARMACY_MEMBER_FIELDS}, rx.medication, rx.dosage, rx.instructions,
              rx.fulfilment_status, rx.fulfilment_method, rx.delivery_address,
              rx.courier_name, rx.tracking_ref, rx.created_at, c.doctor_name
         FROM prescriptions rx
         JOIN members m ON rx.member_id = m.id
         JOIN consultations c ON rx.consultation_id = c.id
        WHERE rx.pharmacy_org_id = $1
        ORDER BY rx.created_at DESC`,
      [orgId]
    )).rows;
    res.json({ type: 'pharmacy', queue: rows });
    return;
  }

  const rows = (await query(
    `SELECT c.id, ${CLINIC_MEMBER_FIELDS}, c.mode, c.channel, c.reason, c.scheduled_at,
            c.status, c.doctor_name, c.diagnosis, c.created_at
       FROM consultations c
       JOIN members m ON c.member_id = m.id
      WHERE c.provider_org_id = $1
      ORDER BY c.scheduled_at ASC NULLS LAST, c.created_at DESC`,
    [orgId]
  )).rows;
  res.json({ type: org.type, queue: rows });
}

// GET /supply/staff — the clinicians (doctors/pharmacists) at this org.
export async function listSupplyStaff(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const rows = (await query(
    `SELECT pr.id, pr.full_name, pr.email, pr.role, pr.specialty, pr.is_active, po.is_primary
       FROM provider_organisations po
       JOIN providers pr ON po.provider_id = pr.id
      WHERE po.org_id = $1
      ORDER BY pr.full_name`,
    [orgId]
  )).rows;
  res.json({ staff: rows });
}

// POST /supply/staff — a supply-org admin adds a clinician to their own org.
// Role is inferred from the org type (clinic → doctor, pharmacy → pharmacist).
export async function addSupplyStaff(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const org = await orgInfo(orgId);
  if (!org) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }
  const role = org.type === 'pharmacy' ? 'pharmacist' : 'doctor';
  const { fullName, email, password, specialty } = req.body;

  if (!fullName || !String(fullName).trim() || !email) {
    res.status(400).json({ error: 'Name and email are required.' });
    return;
  }
  const pwIssue = passwordIssue(password);
  if (pwIssue) {
    res.status(400).json({ error: pwIssue });
    return;
  }
  const clash = await query('SELECT 1 FROM providers WHERE email = $1', [email]);
  if (clash.rows.length > 0) {
    res.status(409).json({ error: 'A clinician with that email already exists.' });
    return;
  }

  const hash = await bcrypt.hash(String(password), 12);
  const r = await query(
    `INSERT INTO providers (partner_id, full_name, email, password_hash, role, specialty)
     VALUES (NULL, $1, $2, $3, $4, $5)
     RETURNING id, full_name, email, role, specialty, is_active`,
    [String(fullName).slice(0, 255), email, hash, role, String(specialty || '')]
  );
  await query(
    `INSERT INTO provider_organisations (provider_id, org_id, is_primary)
     VALUES ($1, $2, true) ON CONFLICT (provider_id, org_id) DO NOTHING`,
    [r.rows[0].id, orgId]
  );

  await recordAudit(req, {
    action: 'provider.create', targetType: 'provider', targetId: r.rows[0].id,
    targetLabel: r.rows[0].full_name, orgId, metadata: { role, via: 'supply_admin' },
  });

  res.status(201).json({ ...r.rows[0], is_primary: true });
}

// PATCH /supply/staff/:id — activate / deactivate one of the org's own clinicians.
export async function setSupplyStaffActive(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const id = String(req.params.id);
  const isActive = Boolean(req.body?.isActive);

  const belongs = await query(
    'SELECT 1 FROM provider_organisations WHERE provider_id = $1 AND org_id = $2',
    [id, orgId]
  );
  if (belongs.rows.length === 0) {
    res.status(404).json({ error: 'Clinician not found in your organisation.' });
    return;
  }
  const r = await query(
    'UPDATE providers SET is_active = $2 WHERE id = $1 RETURNING id, is_active',
    [id, isActive]
  );
  res.json(r.rows[0]);
}
