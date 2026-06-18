import { Request, Response } from 'express';
import { query } from '../config/database';
import {
  advanceIntake, createMemberFromIntake, initialIntakeState, IntakeState, INTAKE_INTRO,
} from '../services/intake.service';
import { buddyMenuScreen, buddyTipScreen, buddyTopicLabel } from '../lib/buddyMenu';

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
  const parts = text === '' ? [] : String(text).split('*');

  res.set('Content-Type', 'text/plain');

  // Opening screen, before any input.
  if (parts.length === 0) {
    res.send(`CON ${USSD_OPENING}`);
    return;
  }

  // Health Buddy branch (first input "0"): a curated menu of short, sourced tips.
  // Enrolment is unaffected — an org code as the first input never starts with "0".
  if (parts[0] === '0') {
    const nav = parts.slice(1);
    if (nav.length === 0) {
      res.send(`CON ${buddyMenuScreen()}`);
      return;
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
    res.send(`END ${tip}`);
    return;
  }

  // Replay every answer so far through the engine.
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

  res.send(`${done ? 'END' : 'CON'} ${reply}`);
}
