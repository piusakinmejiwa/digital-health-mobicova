import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { constantTimeEqual } from '../lib/safeCompare';
import {
  advanceIntake, createMemberFromIntake, initialIntakeState, IntakeState, INTAKE_INTRO,
} from '../services/intake.service';
import { buddyMenuScreen, buddyTipScreen, buddyTopicLabel } from '../lib/buddyMenu';
import { findMemberByPhone, memberMenu, handleMemberChoice } from '../lib/memberServices';

// Africa's Talking calls these endpoints directly (no dashboard JWT). Guard with
// AT_WEBHOOK_TOKEN appended as ?token= on the callback URLs registered with AT.
// Enforced ONLY once a token is configured, so enabling it is a config step
// (set the env + update the AT URL) that doesn't break a live service code that
// predates it. Compare is constant-time.
function atTokenOk(req: Request): boolean {
  if (!env.atWebhookToken) return true;
  return constantTimeEqual(String(req.query.token || ''), env.atWebhookToken);
}

// USSD opening adds a Health Buddy option. INTAKE_INTRO (shared with WhatsApp) is
// left untouched; entering an org code as the first input still goes to enrolment.
const USSD_OPENING = `${INTAKE_INTRO}\n0 Health Buddy (free health tips)`;

// USSD gateway endpoint, shaped for Africa's Talking (also works with most
// aggregators). The gateway POSTs sessionId, phoneNumber, serviceCode and `text`
// — the accumulated, '*'-joined history of everything the user has typed this
// session. We reply with plain text prefixed by:
//   CON  → keep the session open, expecting more input
//   END  → terminate the session
//
// USSD is stateless: we rebuild the conversation by replaying `text` through the
// intake engine on every request, so no per-session storage is needed. The
// member is created exactly once, on the request whose input completes the flow.
export async function handleUssd(req: Request, res: Response): Promise<void> {
  const phoneNumber: string = req.body?.phoneNumber || '';
  const text: string = req.body?.text ?? '';

  res.set('Content-Type', 'text/plain');
  if (!atTokenOk(req)) { res.status(403).send('END Unauthorised request.'); return; }

  res.send(await ussdReply(phoneNumber, text));
}

// The USSD engine, as a pure function of (phoneNumber, accumulated text) → the
// full "CON …"/"END …" reply string. Extracted from the HTTP handler so a health
// probe can exercise the real code path (see ussdSelfTest). No side effects for an
// opening request (empty text); member creation only fires when a flow completes.
export async function ussdReply(phoneNumber: string, text: string): Promise<string> {
  const parts = text === '' ? [] : String(text).split('*');

  // Identify the caller: a known member gets self-service; everyone else gets
  // enrolment. The MSISDN is the identity — no password on USSD.
  const member = await findMemberByPhone(phoneNumber);

  // Opening screen, before any input.
  if (parts.length === 0) {
    return `CON ${member ? memberMenu(member.full_name) : USSD_OPENING}`;
  }

  // Member self-service (options 1–5). Option 0 still goes to the Health Buddy below.
  if (member && ['1', '2', '3', '4', '5'].includes(parts[0])) {
    const out = await handleMemberChoice(member, parts[0], 'ussd');
    return `END ${out ?? 'Sorry, please try again.'}`;
  }

  // Health Buddy branch (first input "0"): a curated menu of short, sourced tips.
  // Enrolment is unaffected — an org code as the first input never starts with "0".
  if (parts[0] === '0') {
    const nav = parts.slice(1);
    if (nav.length === 0) {
      return `CON ${buddyMenuScreen()}`;
    }
    const choice = nav[0];
    const tip = buddyTipScreen(choice);
    try {
      await query(
        `INSERT INTO buddy_messages (session_key, channel, role, content, safety)
         VALUES ($1,'ussd','user',$2,'ok'),($1,'ussd','assistant',$3,'ok')`,
        [phoneNumber.slice(0, 80), `topic: ${buddyTopicLabel(choice)}`, tip]
      );
    } catch (err) {
      console.error('USSD buddy log failed (non-fatal):', err);
    }
    return `END ${tip}`;
  }

  // A known member only has options 0–4; anything else just re-shows the menu.
  if (member) {
    return `CON Invalid option.\n${memberMenu(member.full_name)}`;
  }

  // Replay every answer so far through the engine (enrolment for non-members).
  let state: IntakeState = initialIntakeState();
  let reply = INTAKE_INTRO;
  let done = false;
  for (const part of parts) {
    const result = await advanceIntake(state, part);
    state = result.state;
    reply = result.reply;
    done = result.done;
  }

  // Persist exactly once, when this request's final input completed the flow.
  if (done && state.step === 'done') {
    await createMemberFromIntake(state, { phone: phoneNumber, channel: 'ussd' });
  }

  return `${done ? 'END' : 'CON'} ${reply}`;
}

// GET /channels/ussd/selftest — deep health probe for USSD. Runs a synthetic
// opening request through the REAL engine (empty text → the opening menu), which
// exercises the route, the controller and the database (findMemberByPhone). A
// healthy USSD service returns a "CON …" opening screen. Returns 200 when good,
// 503 otherwise, so an external uptime monitor can alert the instant USSD breaks —
// something /healthz and /readyz don't catch. Side-effect free; exposes no data.
//
// Note: this proves OUR code + DB are healthy. If this is green but real dials
// still fail, the fault is on the Africa's Talking / telco side — the service-code
// callback URL, the ?token= on it, or the service code itself — not the app.
export async function ussdSelfTest(_req: Request, res: Response): Promise<void> {
  const started = Date.now();
  try {
    const reply = await ussdReply('+000000000000', '');
    const ms = Date.now() - started;
    if (!reply.startsWith('CON ')) {
      res.status(503).json({ ok: false, error: 'USSD engine did not return an opening screen', ms });
      return;
    }
    // requiresToken flags whether the public webhook is guarded — a quick way to
    // spot the "AT calling without ?token= → 403" misconfiguration.
    res.json({ ok: true, ms, requiresToken: !!env.atWebhookToken });
  } catch (err) {
    res.status(503).json({ ok: false, error: (err as Error).message, ms: Date.now() - started });
  }
}

// POST /channels/ussd/notification — Africa's Talking end-of-session notification.
// Optional second callback (set under USSD → Service Codes). We just acknowledge
// it (and log) so AT doesn't flag a delivery error; no menu response is expected.
export async function handleUssdNotification(req: Request, res: Response): Promise<void> {
  if (!atTokenOk(req)) { res.sendStatus(403); return; }
  console.log('[ussd] session ended:', {
    sessionId: req.body?.sessionId, serviceCode: req.body?.serviceCode,
    networkCode: req.body?.networkCode, date: req.body?.date,
  });
  res.sendStatus(200);
}
