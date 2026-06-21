import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { signProviderToken } from '../lib/providerAuth';
import { dailyConfigured, ensureRoom, createMeetingToken, roomNameForConsult, recordingConfigured, listRoomRecordings, getRecordingAccessLink } from '../lib/daily';
import { haversineKm } from '../lib/geo';

// ── Provider org context (unified model; a clinician may span several orgs) ──
export interface ProviderOrg { id: string; name: string; type: string; is_primary: boolean }

async function getProviderOrgs(providerId: string): Promise<ProviderOrg[]> {
  const r = await query(
    `SELECT o.id, o.name, o.type, po.is_primary
       FROM provider_organisations po
       JOIN organisations o ON po.org_id = o.id
      WHERE po.provider_id = $1
      ORDER BY po.is_primary DESC, o.name`,
    [providerId]
  );
  return r.rows;
}

// The org a clinician is acting as for this request: the requested org if they
// belong to it, else their primary (first) org, else null (legacy partner-only).
async function resolveActiveOrgId(providerId: string, requested?: string | null): Promise<string | null> {
  const orgs = await getProviderOrgs(providerId);
  if (orgs.length === 0) return null;
  if (requested && orgs.some((o) => o.id === requested)) return requested;
  return orgs[0].id;
}

// ── Auth ────────────────────────────────────────────────────────────────
// POST /provider/auth/login { email, password }
export async function providerLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  const result = await query(
    `SELECT pr.id, pr.partner_id, pr.full_name, pr.email, pr.password_hash, pr.role, pr.specialty,
            p.name AS partner_name, p.category AS partner_category
     FROM providers pr LEFT JOIN partners p ON pr.partner_id = p.id
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
  const organisations = await getProviderOrgs(provider.id);
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
      organisations,
      activeOrgId: organisations[0]?.id ?? null,
    },
  });
}

// GET /provider/me
export async function getProviderMe(req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT pr.id, pr.full_name, pr.email, pr.role, pr.specialty,
            p.name AS partner_name, p.category AS partner_category
     FROM providers pr LEFT JOIN partners p ON pr.partner_id = p.id
     WHERE pr.id = $1`,
    [req.provider!.providerId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }
  const r = result.rows[0];
  const organisations = await getProviderOrgs(r.id);
  res.json({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    role: r.role,
    specialty: r.specialty,
    partnerName: r.partner_name,
    partnerCategory: r.partner_category,
    organisations,
    activeOrgId: organisations[0]?.id ?? null,
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

// GET /provider/consultations?status=&orgId=
export async function listProviderConsultations(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const activeOrgId = await resolveActiveOrgId(req.provider!.providerId, req.query.orgId ? String(req.query.orgId) : null);
  const status = req.query.status ? String(req.query.status) : null;
  // $1 = active org id (nullable), $2 = legacy partner id.
  const params: unknown[] = [activeOrgId, partnerId];
  let where = 'WHERE (c.provider_org_id = $1::uuid OR c.partner_id = $2)';
  if (status) {
    params.push(status);
    where += ` AND c.status = $${params.length}`;
  }
  const result = await query(`${CONSULT_SELECT} ${where} ORDER BY c.scheduled_at ASC NULLS LAST, c.created_at DESC`, params as any[]);
  const counts = await query(
    `SELECT status, COUNT(*)::int AS count FROM consultations c
      WHERE (c.provider_org_id = $1::uuid OR c.partner_id = $2) GROUP BY status`,
    [activeOrgId, partnerId]
  );
  res.json({ consultations: result.rows, counts: counts.rows });
}

// GET /provider/consultations/:id?orgId=
export async function getProviderConsultation(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const activeOrgId = await resolveActiveOrgId(req.provider!.providerId, req.query.orgId ? String(req.query.orgId) : null);
  const id = String(req.params.id);
  const result = await query(`${CONSULT_SELECT} WHERE c.id = $1 AND (c.provider_org_id = $2::uuid OR c.partner_id = $3)`, [id, activeOrgId, partnerId]);
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
  const requestedOrg = req.body?.orgId || req.query.orgId;
  const activeOrgId = await resolveActiveOrgId(providerId, requestedOrg ? String(requestedOrg) : null);

  // Accepting stamps the consult with the clinic the doctor is acting as.
  const result = await query(
    `UPDATE consultations
        SET status = 'in_progress', provider_id = $3, doctor_name = $4,
            provider_org_id = COALESCE(provider_org_id, $5::uuid), updated_at = NOW()
      WHERE id = $1 AND (provider_org_id = $5::uuid OR partner_id = $2) AND status = 'scheduled'
      RETURNING id`,
    [id, partnerId, providerId, name, activeOrgId]
  );
  if (result.rows.length === 0) {
    res.status(409).json({ error: 'This consultation can no longer be accepted.' });
    return;
  }
  res.json({ accepted: true });
}

// POST /provider/consultations/:id/call — join the live video room for a consult.
// Ensures the Daily room exists (creating it if the member hasn't yet), stores it
// on the consultation, and returns the clinician's host token. 503 if Daily isn't
// configured. Scoped to the doctor's own org/partner.
export async function providerConsultationCall(req: Request, res: Response): Promise<void> {
  if (!dailyConfigured()) {
    res.status(503).json({ error: 'Video calling is not set up yet. Add DAILY_API_KEY to enable it.' });
    return;
  }
  const partnerId = req.provider!.partnerId;
  const providerId = req.provider!.providerId;
  const id = String(req.params.id);
  const requestedOrg = req.body?.orgId || req.query.orgId;
  const activeOrgId = await resolveActiveOrgId(providerId, requestedOrg ? String(requestedOrg) : null);

  const c = await query(
    `SELECT id, video_room, mode, recording_consent FROM consultations
      WHERE id = $1 AND (provider_org_id = $2::uuid OR partner_id = $3)`,
    [id, activeOrgId, partnerId]
  );
  if (c.rows.length === 0) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }

  const roomName = roomNameForConsult(id);
  let roomUrl: string = c.rows[0].video_room;
  if (!roomUrl) {
    roomUrl = await ensureRoom(roomName);
    await query('UPDATE consultations SET video_room = $1 WHERE id = $2', [roomUrl, id]);
  }

  // Record only if the member consented AND recording is enabled. The doctor is
  // the room owner, so auto-start rides on their token.
  const willRecord = recordingConfigured() && c.rows[0].recording_consent === true;
  if (willRecord) {
    await query(`UPDATE consultations SET recording_status = 'recording' WHERE id = $1`, [id]);
  }

  const me = await query('SELECT full_name FROM providers WHERE id = $1', [providerId]);
  // Voice consults join the same room with the camera off (audio-first).
  const token = await createMeetingToken(roomName, true, me.rows[0]?.full_name || 'Doctor', c.rows[0].mode === 'voice', willRecord);
  res.json({ roomUrl, token, mode: c.rows[0].mode, recording: willRecord, recordingConsent: c.rows[0].recording_consent === true });
}

// PATCH /provider/consultations/:id — update notes / diagnosis / status (e.g.
// complete). Only the partner's own consults; a clinician can't reopen a closed one.
export async function updateProviderConsultation(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const id = String(req.params.id);
  const { status, notes, diagnosis } = req.body;
  const requestedOrg = req.body?.orgId || req.query.orgId;
  const activeOrgId = await resolveActiveOrgId(req.provider!.providerId, requestedOrg ? String(requestedOrg) : null);

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
      WHERE id = $1 AND (provider_org_id = $6::uuid OR partner_id = $2) AND status <> 'completed'
      RETURNING *`,
    [id, partnerId, status ?? null, notes ?? null, diagnosis ?? null, activeOrgId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Consultation not found or already completed.' });
    return;
  }
  res.json(result.rows[0]);
}

// GET /provider/pharmacies — the pharmacy ORGANISATIONS a doctor can route a
// script to (unified org model). Falls back to legacy pharmacy partners if the
// org-model data migration hasn't run yet.
// GET /provider/pharmacies?consultId= — pharmacies a doctor can route a script
// to. When a consult id is given and both the member and pharmacies are geo-located,
// the list is sorted nearest-first (each with a distance) so the doctor's default
// pick is the closest pharmacy to that patient.
export async function listPharmacies(req: Request, res: Response): Promise<void> {
  const orgs = await query(
    `SELECT id, name, city, latitude, longitude FROM organisations WHERE type = 'pharmacy' AND is_active = true ORDER BY name`
  );
  let rows: any[] = orgs.rows;
  if (rows.length === 0) {
    const legacy = await query(
      `SELECT id, name, NULL::text AS city, NULL::float8 AS latitude, NULL::float8 AS longitude
         FROM partners WHERE category = 'pharmacy' AND status = 'active' ORDER BY name`
    );
    rows = legacy.rows;
  }

  // If we know the member's location, rank by distance.
  const consultId = req.query.consultId ? String(req.query.consultId) : '';
  if (consultId) {
    const m = await query(
      `SELECT mem.latitude, mem.longitude FROM consultations c
         JOIN members mem ON mem.id = c.member_id WHERE c.id = $1`,
      [consultId]
    );
    const lat = m.rows[0]?.latitude;
    const lng = m.rows[0]?.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      const here = { lat, lng };
      rows = rows
        .map((p) => ({
          ...p,
          distanceKm: (typeof p.latitude === 'number' && typeof p.longitude === 'number')
            ? haversineKm(here, { lat: p.latitude, lng: p.longitude })
            : null,
        }))
        .sort((a, b) => {
          if (a.distanceKm == null) return 1;
          if (b.distanceKm == null) return -1;
          return a.distanceKm - b.distanceKm;
        });
    }
  }

  res.json({ pharmacies: rows.map(({ latitude, longitude, ...rest }) => rest) });
}

// GET /provider/consultations/:id/recording — a fresh signed link to the
// consultation's recording (if any). PHI: links are short-lived, never stored.
export async function getConsultationRecording(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const activeOrgId = await resolveActiveOrgId(req.provider!.providerId, req.query.orgId ? String(req.query.orgId) : null);
  const id = String(req.params.id);
  const owns = await query(
    `SELECT recording_consent FROM consultations WHERE id = $1 AND (provider_org_id = $2::uuid OR partner_id = $3)`,
    [id, activeOrgId, partnerId]
  );
  if (owns.rows.length === 0) { res.status(404).json({ error: 'Consultation not found' }); return; }

  const recs = await listRoomRecordings(roomNameForConsult(id));
  const latest = recs[0];
  if (!latest) { res.json({ available: false, consent: owns.rows[0].recording_consent === true }); return; }
  const link = await getRecordingAccessLink(latest.id);
  res.json({
    available: true,
    consent: owns.rows[0].recording_consent === true,
    status: latest.status,
    durationSeconds: latest.duration,
    link,
  });
}

// POST /provider/consultations/:id/prescriptions — issue an e-prescription.
export async function addProviderPrescription(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const id = String(req.params.id);
  // The chosen pharmacy id may be an organisation id (new) or a legacy partner
  // id (old client/data). Accept either field name.
  const { medication, dosage, instructions } = req.body;
  const chosen = String(req.body?.pharmacyOrgId || req.body?.pharmacyPartnerId || '') || null;

  if (!medication || !String(medication).trim()) {
    res.status(400).json({ error: 'Medication is required.' });
    return;
  }

  const requestedOrg = req.body?.orgId || req.query.orgId;
  const activeOrgId = await resolveActiveOrgId(req.provider!.providerId, requestedOrg ? String(requestedOrg) : null);
  const consult = await query(
    `SELECT member_id FROM consultations WHERE id = $1 AND (provider_org_id = $2::uuid OR partner_id = $3)`,
    [id, activeOrgId, partnerId]
  );
  if (consult.rows.length === 0) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }

  // Resolve the destination pharmacy ORGANISATION: by org id, then by the org's
  // legacy partner id, then the first pharmacy org. The matching org carries the
  // legacy partner id, so we store org id + partner id + name together and every
  // reader (old or new) keeps working.
  let org = await query(
    `SELECT id, name, legacy_partner_id FROM organisations WHERE type = 'pharmacy' AND id = $1`,
    [chosen]
  );
  if (org.rows.length === 0) {
    org = await query(
      `SELECT id, name, legacy_partner_id FROM organisations WHERE type = 'pharmacy' AND legacy_partner_id = $1`,
      [chosen]
    );
  }
  if (org.rows.length === 0) {
    org = await query(`SELECT id, name, legacy_partner_id FROM organisations WHERE type = 'pharmacy' ORDER BY name LIMIT 1`);
  }

  let pharmacyOrgId: string | null = org.rows[0]?.id ?? null;
  let pharmacyName: string = org.rows[0]?.name ?? '';
  let pharmacyPartnerId: string | null = org.rows[0]?.legacy_partner_id ?? null;

  // Pre-migration fallback: no pharmacy orgs yet — use legacy partners directly.
  if (!org.rows[0]) {
    let p = await query(`SELECT id, name FROM partners WHERE category = 'pharmacy' AND id = $1`, [chosen]);
    if (p.rows.length === 0) p = await query(`SELECT id, name FROM partners WHERE category = 'pharmacy' ORDER BY name LIMIT 1`);
    pharmacyName = p.rows[0]?.name ?? '';
    pharmacyPartnerId = p.rows[0]?.id ?? null;
    pharmacyOrgId = null;
  }

  const result = await query(
    `INSERT INTO prescriptions
       (consultation_id, member_id, medication, dosage, instructions, pharmacy_partner, pharmacy_partner_id, pharmacy_org_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [id, consult.rows[0].member_id, String(medication).slice(0, 255), String(dosage || ''), String(instructions || ''), pharmacyName, pharmacyPartnerId, pharmacyOrgId]
  );
  res.status(201).json(result.rows[0]);
}

// ── Pharmacist: dispensary ──────────────────────────────────────────────
// A pharmacist sees prescriptions routed to their pharmacy (matched on the
// partner name carried on the prescription).
const RX_SELECT = `
  SELECT rx.id, rx.consultation_id, rx.member_id, m.full_name AS member_name,
         rx.medication, rx.dosage, rx.instructions, rx.pharmacy_partner,
         rx.fulfilment_status, rx.fulfilment_method, rx.delivery_address,
         rx.courier_name, rx.tracking_ref, rx.dispensed_at, rx.ready_at,
         rx.dispatched_at, rx.completed_at, rx.created_at,
         c.diagnosis, c.doctor_name
  FROM prescriptions rx
  JOIN members m ON rx.member_id = m.id
  JOIN consultations c ON rx.consultation_id = c.id
`;

// Match prescriptions to a pharmacy by org id (unified model), OR legacy partner
// id, OR (oldest rows) the partner name carried on the prescription.
// Params: $1 = pharmacy org id (nullable), $2 = partner id, $3 = partner name.
const RX_MATCH = `(rx.pharmacy_org_id = $1::uuid OR rx.pharmacy_partner_id = $2 OR (rx.pharmacy_partner_id IS NULL AND rx.pharmacy_partner = $3))`;

// Resolve the calling pharmacist's pharmacy org (switcher-aware via the org
// membership, then the legacy partner link) plus the partner name, so we can
// match prescriptions across old and new routing.
async function pharmacyContext(
  providerId: string, partnerId: string | null, requestedOrgId?: string | null
): Promise<{ orgId: string | null; partnerName: string }> {
  let orgId = await resolveActiveOrgId(providerId, requestedOrgId ?? null);
  if (!orgId && partnerId) {
    const org = await query(
      `SELECT id FROM organisations WHERE type = 'pharmacy' AND legacy_partner_id = $1 LIMIT 1`,
      [partnerId]
    );
    orgId = org.rows[0]?.id ?? null;
  }
  let partnerName = '';
  if (partnerId) {
    const partner = await query('SELECT name FROM partners WHERE id = $1', [partnerId]);
    partnerName = partner.rows[0]?.name || '';
  }
  return { orgId, partnerName };
}

// GET /provider/prescriptions?status=&orgId=
export async function listProviderPrescriptions(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const { orgId, partnerName } = await pharmacyContext(
    req.provider!.providerId, partnerId, req.query.orgId ? String(req.query.orgId) : null
  );
  const status = req.query.status ? String(req.query.status) : null;

  const params: unknown[] = [orgId, partnerId, partnerName];
  let where = `WHERE ${RX_MATCH}`;
  if (status) {
    params.push(status);
    where += ` AND rx.fulfilment_status = $${params.length}`;
  }
  const result = await query(`${RX_SELECT} ${where} ORDER BY rx.created_at DESC`, params as any[]);
  const counts = await query(
    `SELECT fulfilment_status AS status, COUNT(*)::int AS count
     FROM prescriptions rx WHERE ${RX_MATCH} GROUP BY fulfilment_status`,
    [orgId, partnerId, partnerName]
  );
  res.json({ prescriptions: result.rows, counts: counts.rows });
}

// Fulfilment state machine. Pickup: pending → ready → collected.
// Delivery: pending → ready → out_for_delivery → delivered.
// (legacy 'dispensed' rows can still be closed out.)
const RX_TRANSITIONS: Record<string, string[]> = {
  pending: ['ready'],
  ready: ['out_for_delivery', 'collected'],
  out_for_delivery: ['delivered'],
  dispensed: ['out_for_delivery', 'collected', 'delivered'],
};

// PATCH /provider/prescriptions/:id/advance — move a prescription to the next
// fulfilment status (pharmacist), stamping the relevant time + courier details.
export async function advancePrescription(req: Request, res: Response): Promise<void> {
  const partnerId = req.provider!.partnerId;
  const id = String(req.params.id);
  const status = String(req.body?.status || '');
  const { orgId, partnerName } = await pharmacyContext(
    req.provider!.providerId, partnerId, (req.body?.orgId || req.query.orgId) ? String(req.body?.orgId || req.query.orgId) : null
  );

  const cur = await query(`SELECT rx.* FROM prescriptions rx WHERE rx.id = $4 AND ${RX_MATCH}`, [orgId, partnerId, partnerName, id]);
  if (cur.rows.length === 0) {
    res.status(404).json({ error: 'Prescription not found for your pharmacy.' });
    return;
  }
  const allowed = RX_TRANSITIONS[cur.rows[0].fulfilment_status] || [];
  if (!allowed.includes(status)) {
    res.status(409).json({ error: `Cannot move from ${cur.rows[0].fulfilment_status} to ${status}.` });
    return;
  }

  const sets = ['fulfilment_status = $2'];
  const params: unknown[] = [id, status];
  if (status === 'ready') sets.push('ready_at = NOW()', 'dispensed_at = COALESCE(dispensed_at, NOW())');
  if (status === 'out_for_delivery') {
    sets.push('dispatched_at = NOW()');
    params.push(String(req.body?.courierName || 'MobiCova Rider').slice(0, 160));
    sets.push(`courier_name = $${params.length}`);
    const ref = String(req.body?.trackingRef || `TRK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`).slice(0, 60);
    params.push(ref);
    sets.push(`tracking_ref = $${params.length}`);
  }
  if (status === 'collected' || status === 'delivered') sets.push('completed_at = NOW()');

  const result = await query(`UPDATE prescriptions SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params as any[]);
  res.json(result.rows[0]);
}
