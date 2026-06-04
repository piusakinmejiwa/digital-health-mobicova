import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { recordAudit } from '../lib/audit';
import {
  generateOtpCode, hashOtp, verifyOtpHash, signMemberToken,
  maskDestination, OTP_TTL_MS, OTP_MAX_ATTEMPTS,
} from '../lib/memberAuth';
import { generateClaimReference, isClaimType } from '../lib/claims';
import { emitEvent } from '../lib/webhooks';
import { runTriage, TriageMessage } from '../services/triage.service';

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
// set and the member has a phone. SMS/email gateways are future work. Returns
// the channel used, or 'none' when nothing could deliver (dev/demo fallback).
async function deliverOtp(member: { phone: string; email: string }, code: string): Promise<{ channel: string; destination: string }> {
  const body = `Your MobiCova verification code is ${code}. It expires in 10 minutes.`;

  if (member.phone && env.whatsappToken && env.whatsappPhoneId) {
    try {
      await fetch(`https://graph.facebook.com/v21.0/${env.whatsappPhoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.whatsappToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: member.phone, type: 'text', text: { body } }),
      });
      return { channel: 'whatsapp', destination: maskDestination(member.phone, 'phone') };
    } catch (err) {
      console.error('OTP WhatsApp send failed:', err);
    }
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
    // No gateway could send it — log it server-side so it's recoverable for demos.
    console.log(`[member-otp] code for ${identifier}: ${code}`);
  }

  res.json({
    sent: true,
    delivered,
    channel: delivery.channel,
    destinationHint: delivery.destination || undefined,
    // The code only ever rides back when we couldn't deliver it (or dev mode is
    // on). With a live SMS/WhatsApp gateway this is absent.
    ...((!delivered || devReveal) ? { devCode: code } : {}),
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
    `SELECT m.id, m.full_name, m.phone, m.email, m.date_of_birth, m.gender, m.channel,
            m.blood_group, m.allergies, m.chronic_conditions, m.current_medications,
            m.status, m.created_at, o.name AS org_name, o.partner_type
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
  res.json({ ...result.rows[0], counts: counts.rows[0] });
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

  res.json({
    enrolments: enrolments.rows,
    consultations: consultations.rows,
    prescriptions: prescriptions.rows,
    triageSessions: triage.rows,
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
  res.json(updated.rows[0]);
}
