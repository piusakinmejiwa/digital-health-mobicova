import { Request, Response } from 'express';
import {
  advanceIntake, createMemberFromIntake, initialIntakeState, IntakeState, INTAKE_INTRO,
} from '../services/intake.service';

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
    res.send(`CON ${INTAKE_INTRO}`);
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
