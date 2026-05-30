import { Request, Response } from 'express';
import { query } from '../config/database';

const DEMO_DOCTORS = [
  'Dr. Adaeze Okonkwo', 'Dr. Ibrahim Musa', 'Dr. Folake Adeyemi',
  'Dr. Chidi Nwosu', 'Dr. Aisha Bello', 'Dr. Emeka Okafor',
];

export async function listConsultations(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const result = await query(
    `SELECT c.*, m.full_name AS member_name, p.name AS partner_name
     FROM consultations c
     JOIN members m ON c.member_id = m.id
     LEFT JOIN partners p ON c.partner_id = p.id
     WHERE c.org_id = $1 ORDER BY c.created_at DESC`,
    [orgId]
  );
  res.json(result.rows);
}

export async function getConsultation(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;
  const result = await query(
    `SELECT c.*, m.full_name AS member_name, p.name AS partner_name
     FROM consultations c
     JOIN members m ON c.member_id = m.id
     LEFT JOIN partners p ON c.partner_id = p.id
     WHERE c.id = $1 AND c.org_id = $2`,
    [id, orgId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  const prescriptions = await query(
    `SELECT * FROM prescriptions WHERE consultation_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  res.json({ ...result.rows[0], prescriptions: prescriptions.rows });
}

export async function bookConsultation(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { memberId, partnerId, mode, channel, reason, scheduledAt } = req.body;

  const member = await query(`SELECT id FROM members WHERE id = $1 AND org_id = $2`, [memberId, orgId]);
  if (member.rows.length === 0) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Resolve telemedicine partner: provided, or first active telemedicine partner.
  let resolvedPartnerId = partnerId || null;
  if (!resolvedPartnerId) {
    const p = await query(`SELECT id FROM partners WHERE category = 'telemedicine' ORDER BY name LIMIT 1`);
    resolvedPartnerId = p.rows[0]?.id || null;
  }

  const doctor = DEMO_DOCTORS[Math.floor(Math.random() * DEMO_DOCTORS.length)];

  const result = await query(
    `INSERT INTO consultations (org_id, member_id, partner_id, mode, channel, reason, scheduled_at, doctor_name, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
     RETURNING *`,
    [orgId, memberId, resolvedPartnerId, mode || 'video', channel || 'app',
     reason || '', scheduledAt || new Date(Date.now() + 3600 * 1000).toISOString(), doctor]
  );
  res.status(201).json(result.rows[0]);
}

export async function updateConsultation(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;
  const { status, notes, diagnosis } = req.body;

  const result = await query(
    `UPDATE consultations SET
       status = COALESCE($3, status),
       notes = COALESCE($4, notes),
       diagnosis = COALESCE($5, diagnosis),
       updated_at = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING *`,
    [id, orgId, status, notes, diagnosis]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  res.json(result.rows[0]);
}

export async function addPrescription(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;
  const { medication, dosage, instructions, pharmacyPartner } = req.body;

  const consult = await query(
    `SELECT member_id FROM consultations WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  );
  if (consult.rows.length === 0) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }

  let pharmacy = pharmacyPartner;
  if (!pharmacy) {
    const p = await query(`SELECT name FROM partners WHERE category = 'pharmacy' ORDER BY name LIMIT 1`);
    pharmacy = p.rows[0]?.name || '';
  }

  const result = await query(
    `INSERT INTO prescriptions (consultation_id, member_id, medication, dosage, instructions, pharmacy_partner)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, consult.rows[0].member_id, medication, dosage || '', instructions || '', pharmacy]
  );
  res.status(201).json(result.rows[0]);
}
