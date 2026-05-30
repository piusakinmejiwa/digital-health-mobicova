import { Request, Response } from 'express';
import { query } from '../config/database';

export async function listMembers(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const result = await query(
    `SELECT m.*,
            (SELECT COUNT(*)::int FROM consultations c WHERE c.member_id = m.id) AS consultation_count,
            (SELECT COUNT(*)::int FROM enrolments e WHERE e.member_id = m.id) AS enrolment_count
     FROM members m WHERE m.org_id = $1 ORDER BY m.created_at DESC`,
    [orgId]
  );
  res.json(result.rows);
}

export async function getMember(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;

  const result = await query(`SELECT * FROM members WHERE id = $1 AND org_id = $2`, [id, orgId]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const consultations = await query(
    `SELECT c.*, p.name AS partner_name
     FROM consultations c LEFT JOIN partners p ON c.partner_id = p.id
     WHERE c.member_id = $1 ORDER BY c.created_at DESC`,
    [id]
  );
  const enrolments = await query(
    `SELECT e.*, pl.name AS plan_name, pl.plan_type, pl.monthly_premium, pl.currency, pl.underwriter
     FROM enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id
     WHERE e.member_id = $1 ORDER BY e.enrolled_at DESC`,
    [id]
  );
  const triage = await query(
    `SELECT id, triage_level, recommendation, engine, created_at
     FROM triage_sessions WHERE member_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  const prescriptions = await query(
    `SELECT * FROM prescriptions WHERE member_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  res.json({
    ...result.rows[0],
    consultations: consultations.rows,
    enrolments: enrolments.rows,
    triageSessions: triage.rows,
    prescriptions: prescriptions.rows,
  });
}

export async function createMember(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const {
    fullName, phone, email, dateOfBirth, gender, channel,
    bloodGroup, allergies, chronicConditions, currentMedications,
  } = req.body;

  const result = await query(
    `INSERT INTO members (org_id, full_name, phone, email, date_of_birth, gender, channel,
                          blood_group, allergies, chronic_conditions, current_medications)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      orgId, fullName, phone || '', email || '', dateOfBirth || null, gender || '',
      channel || 'app', bloodGroup || '', allergies || [], chronicConditions || [], currentMedications || [],
    ]
  );
  res.status(201).json(result.rows[0]);
}

export async function updateMember(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;
  const {
    fullName, phone, email, dateOfBirth, gender, channel,
    bloodGroup, allergies, chronicConditions, currentMedications, status,
  } = req.body;

  const result = await query(
    `UPDATE members SET
       full_name = COALESCE($3, full_name),
       phone = COALESCE($4, phone),
       email = COALESCE($5, email),
       date_of_birth = COALESCE($6, date_of_birth),
       gender = COALESCE($7, gender),
       channel = COALESCE($8, channel),
       blood_group = COALESCE($9, blood_group),
       allergies = COALESCE($10, allergies),
       chronic_conditions = COALESCE($11, chronic_conditions),
       current_medications = COALESCE($12, current_medications),
       status = COALESCE($13, status),
       updated_at = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING *`,
    [id, orgId, fullName, phone, email, dateOfBirth, gender, channel,
     bloodGroup, allergies, chronicConditions, currentMedications, status]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  res.json(result.rows[0]);
}

export async function deleteMember(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;
  const result = await query(
    `DELETE FROM members WHERE id = $1 AND org_id = $2 RETURNING id`,
    [id, orgId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  res.json({ message: 'Member deleted' });
}
