import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { signProviderToken } from '../lib/providerAuth';

// ── Auth ────────────────────────────────────────────────────────────────
// POST /provider/auth/login { email, password }
export async function providerLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  const result = await query(
    `SELECT pr.id, pr.partner_id, pr.full_name, pr.email, pr.password_hash, pr.role, pr.specialty,
            p.name AS partner_name, p.category AS partner_category
     FROM providers pr JOIN partners p ON pr.partner_id = p.id
     WHERE pr.email = $1 AND pr.is_active = true`,
    [email]
  );
  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const provider = result.rows[0];
  const ok = await bcrypt.compare(String(password || ''), provider.password_hash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signProviderToken(provider.id, provider.partner_id, provider.role);
  res.json({
    token,
    provider: {
      id: provider.id,
      fullName: provider.full_name,
      email: provider.email,
      role: provider.role,
      specialty: provider.specialty,
      partnerName: provider.partner_name,
      partnerCategory: provider.partner_category,
    },
  });
}

// GET /provider/me
export async function getProviderMe(req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT pr.id, pr.full_name, pr.email, pr.role, pr.specialty,
            p.name AS partner_name, p.category AS partner_category
     FROM providers pr JOIN partners p ON pr.partner_id = p.id
     WHERE pr.id = $1`,
    [req.provider!.providerId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }
  const r = result.rows[0];
  res.json({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    role: r.role,
    specialty: r.specialty,
    partnerName: r.partner_name,
    partnerCategory: r.partner_category,
  });
}

// ── Doctor: consultations ───────────────────────────────────────────────
// Consultations are visible to every clinician at the partner that owns them
// (across all the orgs that partner serves).
const CONSULT_SELECT = `
  SELECT c.id, c.org_id, o.name AS org_name, c.member_id, m.full_name AS member_name,
         m.gender, m.date_of_birth, m.allergies, m.chronic_conditions,
         c.mode, c.channel, c.reason, c.scheduled_at, c.status, c.doctor_name,
         c.notes, c.diagnosis, c.provider_id, c.created_at, c.updated_at
  FROM consultations c
  JOIN members m ON c.member_id = m.id
  JOIN organisations o ON c.org_id = o.id
`;

// GET /provider/consultations?status=
export async function listProviderConsultations(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const status = req.query.status ? String(req.query.status) : null;
  const params: unknown[] = [partnerId];
  let where = 'WHERE c.partner_id = $1';
  if (status) {
    params.push(status);
    where += ` AND c.status = $${params.length}`;
  }
  const result = await query(`${CONSULT_SELECT} ${where} ORDER BY c.scheduled_at ASC NULLS LAST, c.created_at DESC`, params as any[]);
  const counts = await query(
    `SELECT status, COUNT(*)::int AS count FROM consultations WHERE partner_id = $1 GROUP BY status`,
    [partnerId]
  );
  res.json({ consultations: result.rows, counts: counts.rows });
}

// GET /provider/consultations/:id
export async function getProviderConsultation(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const id = String(req.params.id);
  const result = await query(`${CONSULT_SELECT} WHERE c.id = $1 AND c.partner_id = $2`, [id, partnerId]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  const rx = await query(
    `SELECT * FROM prescriptions WHERE consultation_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  res.json({ ...result.rows[0], prescriptions: rx.rows });
}

// POST /provider/consultations/:id/accept — the clinician picks up a scheduled
// consult, stamping their name and moving it in-progress.
export async function acceptConsultation(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const providerId = req.provider!.providerId;
  const id = String(req.params.id);

  const me = await query('SELECT full_name FROM providers WHERE id = $1', [providerId]);
  const name = me.rows[0]?.full_name || '';

  const result = await query(
    `UPDATE consultations
        SET status = 'in_progress', provider_id = $3, doctor_name = $4, updated_at = NOW()
      WHERE id = $1 AND partner_id = $2 AND status = 'scheduled'
      RETURNING id`,
    [id, partnerId, providerId, name]
  );
  if (result.rows.length === 0) {
    res.status(409).json({ error: 'This consultation can no longer be accepted.' });
    return;
  }
  res.json({ accepted: true });
}

// PATCH /provider/consultations/:id — update notes / diagnosis / status (e.g.
// complete). Only the partner's own consults; a clinician can't reopen a closed one.
export async function updateProviderConsultation(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const id = String(req.params.id);
  const { status, notes, diagnosis } = req.body;

  const allowed = ['in_progress', 'completed', 'cancelled'];
  if (status !== undefined && !allowed.includes(String(status))) {
    res.status(400).json({ error: 'Invalid status.' });
    return;
  }

  const result = await query(
    `UPDATE consultations
        SET status = COALESCE($3, status),
            notes = COALESCE($4, notes),
            diagnosis = COALESCE($5, diagnosis),
            updated_at = NOW()
      WHERE id = $1 AND partner_id = $2 AND status <> 'completed'
      RETURNING *`,
    [id, partnerId, status ?? null, notes ?? null, diagnosis ?? null]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Consultation not found or already completed.' });
    return;
  }
  res.json(result.rows[0]);
}

// GET /provider/pharmacies — the pharmacy partners a doctor can route a script to.
export async function listPharmacies(_req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT id, name FROM partners WHERE category = 'pharmacy' AND status = 'active' ORDER BY name`
  );
  res.json({ pharmacies: result.rows });
}

// POST /provider/consultations/:id/prescriptions — issue an e-prescription.
export async function addProviderPrescription(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const id = String(req.params.id);
  const { medication, dosage, instructions, pharmacyPartnerId } = req.body;

  if (!medication || !String(medication).trim()) {
    res.status(400).json({ error: 'Medication is required.' });
    return;
  }

  const consult = await query(
    `SELECT member_id FROM consultations WHERE id = $1 AND partner_id = $2`,
    [id, partnerId]
  );
  if (consult.rows.length === 0) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }

  // Resolve the chosen pharmacy partner (by id), falling back to the first one.
  let pharmacy = await query(
    `SELECT id, name FROM partners WHERE category = 'pharmacy' AND id = $1`,
    [pharmacyPartnerId || null]
  );
  if (pharmacy.rows.length === 0) {
    pharmacy = await query(`SELECT id, name FROM partners WHERE category = 'pharmacy' ORDER BY name LIMIT 1`);
  }
  const pharmacyRow = pharmacy.rows[0] || { id: null, name: '' };

  const result = await query(
    `INSERT INTO prescriptions
       (consultation_id, member_id, medication, dosage, instructions, pharmacy_partner, pharmacy_partner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [id, consult.rows[0].member_id, String(medication).slice(0, 255), String(dosage || ''), String(instructions || ''), pharmacyRow.name, pharmacyRow.id]
  );
  res.status(201).json(result.rows[0]);
}

// ── Pharmacist: dispensary ──────────────────────────────────────────────
// A pharmacist sees prescriptions routed to their pharmacy (matched on the
// partner name carried on the prescription).
const RX_SELECT = `
  SELECT rx.id, rx.consultation_id, rx.member_id, m.full_name AS member_name,
         rx.medication, rx.dosage, rx.instructions, rx.pharmacy_partner,
         rx.fulfilment_status, rx.dispensed_at, rx.created_at,
         c.diagnosis, c.doctor_name
  FROM prescriptions rx
  JOIN members m ON rx.member_id = m.id
  JOIN consultations c ON rx.consultation_id = c.id
`;

// Match prescriptions to a pharmacy by stable partner id, OR (for legacy rows
// with no id) by the partner name carried on the prescription.
const RX_MATCH = `(rx.pharmacy_partner_id = $1 OR (rx.pharmacy_partner_id IS NULL AND rx.pharmacy_partner = $2))`;

// GET /provider/prescriptions?status=
export async function listProviderPrescriptions(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const partner = await query('SELECT name FROM partners WHERE id = $1', [partnerId]);
  const partnerName = partner.rows[0]?.name || '';
  const status = req.query.status ? String(req.query.status) : null;

  const params: unknown[] = [partnerId, partnerName];
  let where = `WHERE ${RX_MATCH}`;
  if (status) {
    params.push(status);
    where += ` AND rx.fulfilment_status = $${params.length}`;
  }
  const result = await query(`${RX_SELECT} ${where} ORDER BY rx.created_at DESC`, params as any[]);
  const counts = await query(
    `SELECT fulfilment_status AS status, COUNT(*)::int AS count
     FROM prescriptions rx WHERE ${RX_MATCH} GROUP BY fulfilment_status`,
    [partnerId, partnerName]
  );
  res.json({ prescriptions: result.rows, counts: counts.rows });
}

// PATCH /provider/prescriptions/:id/dispense — mark a prescription dispensed.
export async function dispensePrescription(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const id = String(req.params.id);
  const partner = await query('SELECT name FROM partners WHERE id = $1', [partnerId]);
  const partnerName = partner.rows[0]?.name || '';

  const result = await query(
    `UPDATE prescriptions rx
        SET fulfilment_status = 'dispensed', dispensed_at = NOW()
      WHERE rx.id = $3 AND ${RX_MATCH} AND rx.fulfilment_status <> 'dispensed'
      RETURNING *`,
    [partnerId, partnerName, id]
  );
  if (result.rows.length === 0) {
    res.status(409).json({ error: 'This prescription is not available to dispense.' });
    return;
  }
  res.json(result.rows[0]);
}
