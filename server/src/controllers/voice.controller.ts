import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { constantTimeEqual } from '../lib/safeCompare';
import { bridgeInstruction, endInstruction } from '../lib/voice';

// Public webhooks for the masking-call provider (Africa's Talking). These are
// hit by the provider, not the browser, so there's no member/provider token.
// We guard them with AT_WEBHOOK_TOKEN passed as ?token= on the URLs registered
// in the AT dashboard. Compare is constant-time; when no token is configured we
// fail CLOSED in production (accept only in dev/test) so a misconfigured prod
// can't leave these call-bridging endpoints wide open.
function tokenOk(req: Request): boolean {
  if (!env.atWebhookToken) return env.appEnv !== 'production';
  return constantTimeEqual(String(req.query.token || ''), env.atWebhookToken);
}

// POST /voice/callback — the provider calls this when the MEMBER answers. We
// match the call to its consultation (by the session ref stored at originate
// time) and return XML that bridges to the DOCTOR with the masking caller ID.
export async function voiceCallback(req: Request, res: Response): Promise<void> {
  res.set('Content-Type', 'application/xml');
  if (!tokenOk(req)) { res.status(403).send(endInstruction()); return; }

  // AT posts `sessionId`; Twilio posts `CallSid`. Both are the provider call id
  // we stored as call_ref at originate time.
  const sessionId = String(req.body?.sessionId || req.body?.CallSid || '');
  const r = await query(
    `SELECT c.id, p.phone AS doctor_phone
       FROM consultations c
       LEFT JOIN providers p ON p.id = c.provider_id
      WHERE c.call_ref = $1
      ORDER BY c.created_at DESC LIMIT 1`,
    [sessionId]
  );
  const doctorPhone = (r.rows[0]?.doctor_phone || '').trim();
  if (!doctorPhone) { res.send(endInstruction()); return; }

  await query(`UPDATE consultations SET call_status = 'connecting' WHERE id = $1`, [r.rows[0].id]).catch(() => {});
  res.send(bridgeInstruction(doctorPhone));
}

// POST /voice/event — the provider posts call status + duration as the call
// progresses/ends. We log it onto the consultation and mark it completed when
// the session finishes. Always 200 (best-effort; never blocks the provider).
export async function voiceEvent(req: Request, res: Response): Promise<void> {
  if (!tokenOk(req)) { res.status(403).end(); return; }

  // AT: sessionId/callSessionState/durationInSeconds · Twilio: CallSid/CallStatus/CallDuration.
  const sessionId = String(req.body?.sessionId || req.body?.CallSid || '');
  const state = String(req.body?.callSessionState || req.body?.status || req.body?.CallStatus || '').trim();
  const duration = Math.max(0, Math.floor(Number(req.body?.durationInSeconds ?? req.body?.CallDuration) || 0));

  if (sessionId) {
    const done = /complet|ended|success/i.test(state);
    const notes = `Phone consultation · ${Math.floor(duration / 60)}m ${duration % 60}s (masked call)`;
    await query(
      `UPDATE consultations
          SET call_status = $2,
              status = CASE WHEN $3 THEN 'completed' ELSE status END,
              notes  = CASE WHEN $3 AND (notes IS NULL OR notes = '') THEN $4 ELSE notes END,
              updated_at = NOW()
        WHERE call_ref = $1`,
      [sessionId, state || 'unknown', done, notes]
    ).catch((err) => console.error('[voice] event log failed:', err));
  }
  res.status(200).end();
}
