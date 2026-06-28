import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { recordAudit, writeAudit } from '../lib/audit';
import {
  generateOtpCode, hashOtp, verifyOtpHash, signMemberToken,
  maskDestination, OTP_TTL_MS, OTP_MAX_ATTEMPTS,
} from '../lib/memberAuth';
import { generateClaimReference, isClaimType } from '../lib/claims';
import { emitEvent } from '../lib/webhooks';
import { runTriage, TriageMessage } from '../services/triage.service';
import { getOrgBranding } from '../lib/branding';
import { dailyConfigured, ensureRoom, createMeetingToken, roomNameForConsult, recordingConfigured } from '../lib/daily';
import { voiceConfigured, originateCall, maskingNumber } from '../lib/voice';
import { geocode } from '../lib/geo';
import { sendSms, smsConfigured } from '../lib/messaging';
import { sendEmail } from '../lib/email';
import { award, getMemberRewards, getMemberChallenges, getLeaderboard, setLeaderboardOptIn } from '../lib/rewards';
import { notify } from '../lib/notify';

// ── Identity resolution ─────────────────────────────────────────────────
// A member identifies with either a phone number or an email already on their
// record. Email is matched case-insensitively. We pick the most recently
// created active match (an identifier could, in theory, repeat across tenants).
function looksLikeEmail(s: string): boolean {
  return /.+@.+\..+/.test(s);
}

async function findMemberByIdentifier(identifier: string) {
  const id = identifier.trim();
  if (!id) return null;
  const isEmail = looksLikeEmail(id);
  const result = await query(
    isEmail
      ? `SELECT id, org_id, full_name, phone, email FROM members
         WHERE lower(email) = lower($1) AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`
      : `SELECT id, org_id, full_name, phone, email FROM members
         WHERE regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace($1, '[^0-9]', '', 'g')
           AND phone <> '' AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

// Best-effort OTP delivery. Today we can push over WhatsApp when Meta creds are
// Deliver the login OTP by SMS (Africa's Talking) first, then email (Resend).
// We deliberately do NOT use WhatsApp for OTP: a login code is business-initiated,
// so Meta requires an approved template (plain text would fail outside the 24h
// window), and it's the pricey authentication category. SMS/email are reliable,
// cheap, and need no template. Returns the channel used, or 'none' when nothing
// could deliver (dev/demo fallback surfaces the code instead).
async function deliverOtp(member: { phone: string; email: string }, code: string): Promise<{ channel: string; destination: string }> {
  const text = `Your MobiCova verification code is ${code}. It expires in 10 minutes.`;

  // 1) SMS via Africa's Talking.
  if (member.phone && smsConfigured()) {
    const r = await sendSms(member.phone, text);
    if (r.ok) return { channel: 'sms', destination: maskDestination(member.phone, 'phone') };
    console.error('OTP SMS failed:', r.error);
  }

  // 2) Email via Resend.
  if (member.email) {
    const r = await sendEmail({
      to: member.email,
      subject: 'Your MobiCova verification code',
      html: `<div style="font:16px/1.6 Arial,sans-serif;color:#1f2d2b">Your MobiCova verification code is
        <strong style="font-size:20px;letter-spacing:2px">${code}</strong>.<br>It expires in 10 minutes.</div>`,
      text,
    });
    if (r.sent) return { channel: 'email', destination: maskDestination(member.email, 'email') };
  }

  return { channel: 'none', destination: '' };
}

// POST /member/auth/request-otp  { identifier }
// Always responds 200 with a generic shape so the endpoint can't be used to
// enumerate which phones/emails are members — EXCEPT in dev/demo mode (no live
// delivery channel), where the code is surfaced so the flow is testable.
export async function requestOtp(req: Request, res: Response): Promise<void> {
  const identifier = String(req.body?.identifier || '').trim();
  if (!identifier) {
    res.status(400).json({ error: 'Enter your phone number or email.' });
    return;
  }

  const member = await findMemberByIdentifier(identifier);
  const devReveal = env.otpDevMode; // global "show the code" switch

  if (!member) {
    // Generic response; only reveal "not found" in explicit dev mode.
    res.json({ sent: true, ...(devReveal ? { delivered: false, notFound: true } : {}) });
    return;
  }

  const code = generateOtpCode();
  const codeHash = await hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Invalidate any earlier un-consumed codes, then store the new one.
  await query('UPDATE member_otps SET consumed = true WHERE member_id = $1 AND consumed = false', [member.id]);
  const delivery = await deliverOtp(member, code);
  await query(
    `INSERT INTO member_otps (member_id, code_hash, channel, destination, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [member.id, codeHash, delivery.channel, delivery.destination, expiresAt]
  );

  const delivered = delivery.channel !== 'none';
  if (!delivered) {
    // Couldn't send (member has no deliverable channel). Never log the actual
    // code in production — only surface it under explicit dev mode. Otherwise an
    // un-contactable member's code would land in logs.
    if (devReveal) console.log(`[member-otp] code for ${identifier}: ${code}`);
    else console.warn(`[member-otp] no deliverable channel for member ${member.id}`);
  }

  res.json({
    sent: true,
    delivered,
    channel: delivery.channel,
    destinationHint: delivery.destination || undefined,
    // The code ONLY ever rides back in explicit dev mode. It must never be
    // returned just because delivery failed — for a member with no working
    // channel that would hand an unauthenticated caller a valid login code
    // (account takeover). Such members simply can't log in until contactable.
    ...(devReveal ? { devCode: code } : {}),
  });
}

// POST /member/auth/verify-otp  { identifier, code }
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const identifier = String(req.body?.identifier || '').trim();
  const code = String(req.body?.code || '').replace(/\s+/g, '');
  if (!identifier || !code) {
    res.status(400).json({ error: 'Enter the code we sent you.' });
    return;
  }

  const member = await findMemberByIdentifier(identifier);
  if (!member) {
    res.status(401).json({ error: 'That code is not valid.' });
    return;
  }

  const otpRes = await query(
    `SELECT id, code_hash, attempts, expires_at FROM member_otps
     WHERE member_id = $1 AND consumed = false
     ORDER BY created_at DESC LIMIT 1`,
    [member.id]
  );
  const otp = otpRes.rows[0];
  if (!otp || new Date(otp.expires_at).getTime() < Date.now()) {
    res.status(401).json({ error: 'That code has expired. Request a new one.' });
    return;
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await query('UPDATE member_otps SET consumed = true WHERE id = $1', [otp.id]);
    res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    return;
  }

  const ok = await verifyOtpHash(code, otp.code_hash);
  if (!ok) {
    await query('UPDATE member_otps SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
    res.status(401).json({ error: 'That code is not valid. Try again.' });
    return;
  }

  await query('UPDATE member_otps SET consumed = true WHERE id = $1', [otp.id]);
  await query('UPDATE members SET last_portal_login_at = NOW() WHERE id = $1', [member.id]);

  await writeAudit({
    actorEmail: member.email || null, action: 'member.login', orgId: member.org_id,
    targetType: 'member', targetId: member.id, targetLabel: member.full_name, ip: req.ip,
  });

  const token = signMemberToken(member.id, member.org_id);
  res.json({
    token,
    member: { id: member.id, fullName: member.full_name, orgId: member.org_id },
  });
}

// ── Authenticated portal data ───────────────────────────────────────────

// GET /member/me — profile + org + headline counts for the portal header.
export async function getMemberMe(req: Request, res: Response): Promise<void> {
  const memberId = req.member!.memberId;
  const result = await query(
    `SELECT m.id, m.membership_id, m.full_name, m.phone, m.email, m.date_of_birth, m.gender, m.channel,
            m.blood_group, m.allergies, m.chronic_conditions, m.current_medications,
            m.address, m.city, m.latitude, m.longitude,
            m.status, m.created_at, o.name AS org_name, o.type AS partner_type
     FROM members m JOIN organisations o ON m.org_id = o.id
     WHERE m.id = $1`,
    [memberId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  const counts = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM enrolments  WHERE member_id = $1) AS enrolments,
       (SELECT COUNT(*)::int FROM consultations WHERE member_id = $1) AS consultations,
       (SELECT COUNT(*)::int FROM claims      WHERE member_id = $1) AS claims`,
    [memberId]
  );
  const branding = await getOrgBranding(req.member!.orgId);

  // Reward a completed health profile (once). "Complete" = the basics a clinician
  // needs: DOB, blood group, and at least one contact method.
  const me = result.rows[0];
  if (me.date_of_birth && me.blood_group && (me.phone || me.email)) {
    await award(memberId, req.member!.orgId, 'profile_complete');
  }

  res.json({ ...me, counts: counts.rows[0], branding });
}

// GET /member/rewards — points, streak and badge catalogue for the Rewards screen.
export async function getMemberRewardsHandler(req: Request, res: Response): Promise<void> {
  const data = await getMemberRewards(req.member!.memberId);
  res.json(data);
}

// GET /member/challenges — active challenges with this member's live progress.
export async function getMemberChallengesHandler(req: Request, res: Response): Promise<void> {
  res.json({ challenges: await getMemberChallenges(req.member!.memberId) });
}

// GET /member/leaderboard — anonymised, opt-in ranking within the member's org.
export async function getMemberLeaderboardHandler(req: Request, res: Response): Promise<void> {
  res.json(await getLeaderboard(req.member!.orgId, req.member!.memberId));
}

// POST /member/leaderboard/opt-in { optIn } — join/leave the leaderboard.
export async function setMemberLeaderboardOptIn(req: Request, res: Response): Promise<void> {
  await setLeaderboardOptIn(req.member!.memberId, req.member!.orgId, Boolean(req.body?.optIn));
  res.json(await getLeaderboard(req.member!.orgId, req.member!.memberId));
}

// POST /member/prescriptions/:id/fulfilment — the member chooses pickup or
// courier delivery (with an address) for one of their prescriptions.
export async function setPrescriptionFulfilment(req: Request, res: Response): Promise<void> {
  const memberId = req.member!.memberId;
  const id = String(req.params.id);
  const method = String(req.body?.method || '');
  const address = String(req.body?.address || '').slice(0, 400);

  if (!['pickup', 'delivery'].includes(method)) {
    res.status(400).json({ error: 'Choose pickup or delivery.' });
    return;
  }
  if (method === 'delivery' && !address.trim()) {
    res.status(400).json({ error: 'A delivery address is required.' });
    return;
  }

  const cur = await query('SELECT fulfilment_status FROM prescriptions WHERE id = $1 AND member_id = $2', [id, memberId]);
  if (cur.rows.length === 0) {
    res.status(404).json({ error: 'Prescription not found' });
    return;
  }
  if (['collected', 'delivered'].includes(cur.rows[0].fulfilment_status)) {
    res.status(409).json({ error: 'This prescription has already been fulfilled.' });
    return;
  }

  const result = await query(
    `UPDATE prescriptions SET fulfilment_method = $2, delivery_address = $3 WHERE id = $1 RETURNING *`,
    [id, method, method === 'delivery' ? address : '']
  );
  res.json(result.rows[0]);
}

// GET /member/doctors — active doctors a member can call (telemedicine providers).
export async function getMemberDoctors(_req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT pr.id, pr.full_name, pr.specialty, pr.photo_url, p.name AS partner_name
       FROM providers pr JOIN partners p ON pr.partner_id = p.id
      WHERE pr.role = 'doctor' AND pr.is_active = true
      ORDER BY pr.full_name`
  );
  res.json({ doctors: result.rows });
}

// GET /member/overview — cover + care history in one round trip.
export async function getMemberOverview(req: Request, res: Response): Promise<void> {
  const memberId = req.member!.memberId;

  const enrolments = await query(
    `SELECT e.*, pl.name AS plan_name, pl.plan_type, pl.monthly_premium, pl.currency, pl.underwriter
     FROM enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id
     WHERE e.member_id = $1 ORDER BY e.enrolled_at DESC`,
    [memberId]
  );
  const consultations = await query(
    `SELECT c.*, p.name AS partner_name
     FROM consultations c LEFT JOIN partners p ON c.partner_id = p.id
     WHERE c.member_id = $1 ORDER BY c.created_at DESC`,
    [memberId]
  );
  const prescriptions = await query(
    `SELECT * FROM prescriptions WHERE member_id = $1 ORDER BY created_at DESC`,
    [memberId]
  );
  const triage = await query(
    `SELECT id, triage_level, recommendation, engine, created_at
     FROM triage_sessions WHERE member_id = $1 ORDER BY created_at DESC`,
    [memberId]
  );

  // Daily check-in: opening the portal once a day keeps the engagement streak alive.
  await award(memberId, req.member!.orgId, 'daily_checkin');

  res.json({
    enrolments: enrolments.rows,
    consultations: consultations.rows,
    prescriptions: prescriptions.rows,
    triageSessions: triage.rows,
    // Which live-call channels are switched on (drives the Care page buttons).
    capabilities: { video: dailyConfigured(), phoneCalls: voiceConfigured(), recording: recordingConfigured() },
  });
}

// GET /member/claims — the member's own claims, newest first.
export async function listMemberClaims(req: Request, res: Response): Promise<void> {
  const memberId = req.member!.memberId;
  const result = await query(
    `SELECT c.*, pl.name AS plan_name, pl.underwriter,
            (SELECT COUNT(*)::int FROM claim_documents d WHERE d.claim_id = c.id) AS document_count
     FROM claims c LEFT JOIN insurance_plans pl ON c.plan_id = pl.id
     WHERE c.member_id = $1 ORDER BY c.created_at DESC`,
    [memberId]
  );
  res.json({ claims: result.rows });
}

// GET /member/claims/:id — a single own claim with its documents.
export async function getMemberClaim(req: Request, res: Response): Promise<void> {
  const memberId = req.member!.memberId;
  const id = String(req.params.id);
  const result = await query(
    `SELECT c.*, pl.name AS plan_name, pl.underwriter
     FROM claims c LEFT JOIN insurance_plans pl ON c.plan_id = pl.id
     WHERE c.id = $1 AND c.member_id = $2`,
    [id, memberId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Claim not found' });
    return;
  }
  const docs = await query(
    `SELECT id, label, file_name, file_url, content_type, size_bytes, created_at
     FROM claim_documents WHERE claim_id = $1 ORDER BY created_at`,
    [id]
  );
  res.json({ ...result.rows[0], documents: docs.rows });
}

// POST /member/claims — a member submits a claim against their own cover. Same
// insert path and state machine as the partner-side createClaim (Q6); only the
// submitted_via tag and the auth context differ.
export async function createMemberClaim(req: Request, res: Response): Promise<void> {
  const memberId = req.member!.memberId;
  const orgId = req.member!.orgId;
  const { claimType, providerName, amount, currency, description, serviceDate, enrolmentId } = req.body;

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'Enter the claim amount.' });
    return;
  }

  // Optionally tie the claim to one of the member's own enrolments.
  let resolvedEnrolment: string | null = null;
  let planId: string | null = null;
  if (enrolmentId) {
    const en = await query(
      'SELECT id, plan_id FROM enrolments WHERE id = $1 AND member_id = $2',
      [enrolmentId, memberId]
    );
    if (en.rows.length > 0) {
      resolvedEnrolment = en.rows[0].id;
      planId = en.rows[0].plan_id;
    }
  }

  const reference = generateClaimReference();
  const result = await query(
    `INSERT INTO claims
       (org_id, member_id, enrolment_id, plan_id, reference, claim_type,
        provider_name, service_date, amount, currency, description, submitted_via)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'member_portal')
     RETURNING *`,
    [
      orgId, memberId, resolvedEnrolment, planId, reference,
      isClaimType(claimType) ? claimType : 'outpatient',
      (providerName || '').toString().slice(0, 255),
      serviceDate || null,
      Number(amount) || 0,
      (currency || 'NGN').toString().toUpperCase().slice(0, 10),
      (description || '').toString(),
    ]
  );
  const claim = result.rows[0];

  await recordAudit(req, {
    action: 'claim.create', targetType: 'claim', targetId: claim.id,
    targetLabel: reference, orgId, metadata: { via: 'member_portal', memberId, amount: claim.amount },
  });

  emitEvent(orgId, 'claim.created', {
    claim_id: claim.id,
    reference: claim.reference,
    member_id: claim.member_id,
    claim_type: claim.claim_type,
    provider_name: claim.provider_name,
    amount: claim.amount,
    currency: claim.currency,
    status: claim.status,
    submitted_via: claim.submitted_via,
    created_at: claim.created_at,
    updated_at: claim.updated_at,
  });

  void notify({
    orgId, category: 'claims', severity: 'info',
    title: `New claim ${claim.reference} submitted`,
    body: `₦${Number(claim.amount).toLocaleString('en-NG')} · submitted via the member app.`,
    href: '/claims',
  });

  res.status(201).json(claim);
}

// POST /member/triage — AI symptom check from the member app. Reuses the shared
// triage engine, scoped to the member and their org, with their health profile
// as context. Creates a session on the first message, continues it thereafter.
export async function memberTriage(req: Request, res: Response): Promise<void> {
  const memberId = req.member!.memberId;
  const orgId = req.member!.orgId;
  const { sessionId, message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  let session;
  if (sessionId) {
    const existing = await query(
      `SELECT * FROM triage_sessions WHERE id = $1 AND member_id = $2`,
      [sessionId, memberId]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    session = existing.rows[0];
  } else {
    const created = await query(
      `INSERT INTO triage_sessions (org_id, member_id, messages) VALUES ($1, $2, '[]') RETURNING *`,
      [orgId, memberId]
    );
    session = created.rows[0];
  }

  const m = await query(
    `SELECT full_name, gender, date_of_birth, allergies, chronic_conditions, current_medications
     FROM members WHERE id = $1`,
    [memberId]
  );
  const r = m.rows[0];
  const member = r
    ? {
        fullName: r.full_name, gender: r.gender, dateOfBirth: r.date_of_birth,
        allergies: r.allergies, chronicConditions: r.chronic_conditions, currentMedications: r.current_medications,
      }
    : undefined;

  const history: TriageMessage[] = Array.isArray(session.messages) ? session.messages : [];
  history.push({ role: 'user', content: message });
  const result = await runTriage(history, member);
  history.push({ role: 'assistant', content: result.reply });

  const updated = await query(
    `UPDATE triage_sessions
       SET messages = $2, triage_level = $3, recommendation = $4, engine = $5, updated_at = NOW()
     WHERE id = $1
     RETURNING id, messages, triage_level, recommendation, engine`,
    [session.id, JSON.stringify(history), result.triageLevel, result.recommendation, result.engine]
  );
  await award(memberId, orgId, 'triage');
  res.json(updated.rows[0]);
}

// POST /member/consultations — log a completed telemedicine call as a consultation
// so it appears in the member's "recent care" and the partner's dashboard. Tries to
// attribute it to the called doctor's provider + partner; falls back to the first
// telemedicine partner otherwise.
export async function createMemberConsultation(req: Request, res: Response): Promise<void> {
  const memberId = req.member!.memberId;
  const orgId = req.member!.orgId;
  const { mode, doctorName, durationSeconds } = req.body;

  const m = ['video', 'voice'].includes(String(mode)) ? String(mode) : 'video';
  const name = (doctorName ? String(doctorName) : 'MobiCova Doctor').slice(0, 255);

  let partnerId: string | null = null;
  let providerId: string | null = null;
  const prov = await query('SELECT id, partner_id FROM providers WHERE full_name = $1 LIMIT 1', [name]);
  if (prov.rows.length > 0) {
    providerId = prov.rows[0].id;
    partnerId = prov.rows[0].partner_id;
  }
  if (!partnerId) {
    const p = await query(`SELECT id FROM partners WHERE category = 'telemedicine' ORDER BY name LIMIT 1`);
    partnerId = p.rows[0]?.id ?? null;
  }

  const secs = Math.max(0, Math.floor(Number(durationSeconds) || 0));
  const notes = `${m === 'voice' ? 'Voice' : 'Video'} consultation · ${Math.floor(secs / 60)}m ${secs % 60}s`;

  const result = await query(
    `INSERT INTO consultations
       (org_id, member_id, partner_id, provider_id, mode, channel, reason, scheduled_at, status, doctor_name, notes)
     VALUES ($1, $2, $3, $4, $5, 'app', 'Telemedicine consultation', NOW(), 'completed', $6, $7)
     RETURNING *`,
    [orgId, memberId, partnerId, providerId, m, name, notes]
  );
  res.status(201).json(result.rows[0]);
}

// Resolve the provider + partner for a named doctor, mirroring the booking
// logic above so a consultation routes to the right clinician/telemedicine
// partner (and therefore shows up in that provider's portal queue).
async function resolveDoctorRouting(name: string): Promise<{ providerId: string | null; partnerId: string | null }> {
  let providerId: string | null = null;
  let partnerId: string | null = null;
  const prov = await query('SELECT id, partner_id FROM providers WHERE full_name = $1 LIMIT 1', [name]);
  if (prov.rows.length > 0) {
    providerId = prov.rows[0].id;
    partnerId = prov.rows[0].partner_id;
  }
  if (!partnerId) {
    const p = await query(`SELECT id FROM partners WHERE category = 'telemedicine' ORDER BY name LIMIT 1`);
    partnerId = p.rows[0]?.id ?? null;
  }
  return { providerId, partnerId };
}

// POST /member/consultations/start — begin a live consultation. Creates the
// consultation up-front (status 'in_progress' so it appears in the doctor's
// queue), and — when Daily is configured — provisions a private video room and
// returns the member's join token. If Daily isn't set up yet, `video` is null
// and the client falls back to the demo call screen.
export async function startMemberConsultation(req: Request, res: Response): Promise<void> {
  const memberId = req.member!.memberId;
  const orgId = req.member!.orgId;
  const { mode, doctorName } = req.body;
  const m = ['video', 'voice'].includes(String(mode)) ? String(mode) : 'video';
  const name = (doctorName ? String(doctorName) : 'MobiCova Doctor').slice(0, 255);

  const { providerId, partnerId } = await resolveDoctorRouting(name);

  // Recording consent (NDPR/GDPR): captured before the call. Recording only
  // actually happens if the member consented AND recording is enabled+paid.
  const recordingConsent = Boolean(req.body?.recordingConsent);
  const willRecord = recordingConsent && recordingConfigured();

  const result = await query(
    `INSERT INTO consultations
       (org_id, member_id, partner_id, provider_id, mode, channel, reason, scheduled_at, status, doctor_name, notes,
        recording_consent, recording_consent_at, recording_status)
     VALUES ($1, $2, $3, $4, $5, 'app', 'Telemedicine consultation', NOW(), 'in_progress', $6, '',
        $7, CASE WHEN $7 THEN NOW() ELSE NULL END, $8)
     RETURNING *`,
    [orgId, memberId, partnerId, providerId, m, name,
     recordingConsent, recordingConsent ? 'consented' : 'declined']
  );
  const consultation = result.rows[0];

  // Provision a Daily room for both video and voice (voice = same room, camera
  // off — an app-to-app VoIP call until Phase 2 adds masked PSTN calling).
  let video: { roomUrl: string; token: string } | null = null;
  if (dailyConfigured()) {
    try {
      const roomName = roomNameForConsult(consultation.id);
      const roomUrl = await ensureRoom(roomName);
      await query('UPDATE consultations SET video_room = $1 WHERE id = $2', [roomUrl, consultation.id]);
      consultation.video_room = roomUrl;
      const mem = await query('SELECT full_name FROM members WHERE id = $1', [memberId]);
      const token = await createMeetingToken(roomName, false, mem.rows[0]?.full_name || 'Patient', m === 'voice');
      video = { roomUrl, token };
    } catch (err) {
      console.error('[consult] daily room/token failed:', err);
      // Leave video null → client uses the demo call screen; consult still logged.
    }
  }

  res.status(201).json({ consultation, video, recording: willRecord });
}

// PATCH /member/profile/location — member sets their address so prescriptions can
// route to the nearest pharmacy. Geocoded to coordinates when a key is configured.
export async function updateMemberLocation(req: Request, res: Response): Promise<void> {
  const memberId = req.member!.memberId;
  const address = String(req.body?.address || '').trim().slice(0, 500);
  const city = String(req.body?.city || '').trim().slice(0, 120);

  let lat: number | null = null;
  let lng: number | null = null;
  const coords = await geocode([address, city].filter(Boolean).join(', '));
  if (coords) { lat = coords.lat; lng = coords.lng; }

  await query(
    `UPDATE members SET address = $2, city = $3,
            latitude = COALESCE($4, latitude), longitude = COALESCE($5, longitude), updated_at = NOW()
      WHERE id = $1`,
    [memberId, address, city, lat, lng]
  );
  res.json({ saved: true, geocoded: lat != null });
}

// POST /member/consultations/phone-call — place a real masked phone call: ring
// the member's phone from the MobiCova number, then (on answer) bridge to the
// doctor's number. Creates the consult up-front so it shows in the queue and
// logs; the call duration is stamped later by the /voice/event webhook.
export async function startMemberPhoneCall(req: Request, res: Response): Promise<void> {
  if (!voiceConfigured()) {
    res.status(503).json({ error: 'Phone calling is not set up yet.' });
    return;
  }
  const memberId = req.member!.memberId;
  const orgId = req.member!.orgId;
  const doctorName = (req.body?.doctorName ? String(req.body.doctorName) : 'MobiCova Doctor').slice(0, 255);

  const mem = await query('SELECT phone FROM members WHERE id = $1', [memberId]);
  const memberPhone = (mem.rows[0]?.phone || '').trim();
  if (!memberPhone) {
    res.status(400).json({ error: 'No phone number on file for your account — add one to receive calls.' });
    return;
  }

  const { providerId, partnerId } = await resolveDoctorRouting(doctorName);
  let doctorPhone = '';
  if (providerId) {
    const p = await query('SELECT phone FROM providers WHERE id = $1', [providerId]);
    doctorPhone = (p.rows[0]?.phone || '').trim();
  }
  if (!doctorPhone) {
    res.status(400).json({ error: 'This doctor is not set up for phone calls yet.' });
    return;
  }

  const result = await query(
    `INSERT INTO consultations
       (org_id, member_id, partner_id, provider_id, mode, channel, reason, scheduled_at, status, doctor_name, notes)
     VALUES ($1, $2, $3, $4, 'voice', 'phone', 'Telemedicine phone consultation', NOW(), 'in_progress', $5, '')
     RETURNING id`,
    [orgId, memberId, partnerId, providerId, doctorName]
  );
  const consultId = result.rows[0].id;

  try {
    const { ref } = await originateCall(memberPhone);
    await query(`UPDATE consultations SET call_ref = $1, call_status = 'ringing' WHERE id = $2`, [ref, consultId]);
    res.status(201).json({ consultationId: consultId, status: 'ringing', maskedNumber: maskingNumber(), doctorName });
  } catch (err) {
    console.error('[voice] originate failed:', err);
    await query(`UPDATE consultations SET call_status = 'failed' WHERE id = $1`, [consultId]);
    res.status(502).json({ error: 'Could not place the call right now. Please try again.' });
  }
}

// POST /member/consultations/:id/complete — close out a live consultation the
// member started: record the duration and mark it completed. Member-scoped.
export async function completeMemberConsultation(req: Request, res: Response): Promise<void> {
  const memberId = req.member!.memberId;
  const id = String(req.params.id);
  const secs = Math.max(0, Math.floor(Number(req.body?.durationSeconds) || 0));

  const existing = await query(
    `SELECT mode FROM consultations WHERE id = $1 AND member_id = $2`,
    [id, memberId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  const mode = existing.rows[0].mode;
  const notes = `${mode === 'voice' ? 'Voice' : 'Video'} consultation · ${Math.floor(secs / 60)}m ${secs % 60}s`;

  const result = await query(
    `UPDATE consultations
        SET status = 'completed', notes = $1, updated_at = NOW()
      WHERE id = $2 AND member_id = $3
      RETURNING *`,
    [notes, id, memberId]
  );
  await award(memberId, req.member!.orgId, 'consult_complete', { ref: id });
  res.json(result.rows[0]);
}
