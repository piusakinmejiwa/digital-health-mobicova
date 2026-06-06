import { Request, Response } from 'express';
import { query } from '../config/database';
import { orgClass } from '../lib/orgTypes';
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
