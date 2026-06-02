import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import {
  advanceIntake, createMemberFromIntake, initialIntakeState, IntakeState, IntakeStep,
} from '../services/intake.service';

// WhatsApp intake via Meta's WhatsApp Business Cloud API. Unlike USSD, WhatsApp
// is genuinely stateful (each inbound message stands alone), so we persist the
// conversation in intake_sessions keyed by the sender's phone number.
//
// Three entry points:
//   GET  /channels/whatsapp/webhook  → Meta endpoint verification (echo challenge)
//   POST /channels/whatsapp/webhook  → inbound messages from Meta
//   POST /channels/whatsapp/simulate → local testing without Meta (returns reply)

interface StoredSession {
  id: string;
  step: IntakeStep;
  org_id: string | null;
  data: { orgName?: string; fullName?: string; gender?: string };
  completed: boolean;
}

function toState(row: StoredSession): IntakeState {
  return {
    step: row.step,
    orgId: row.org_id || undefined,
    orgName: row.data?.orgName,
    fullName: row.data?.fullName,
    gender: row.data?.gender,
  };
}

async function loadOrStartSession(identifier: string): Promise<StoredSession> {
  const existing = await query(
    `SELECT id, step, org_id, data, completed FROM intake_sessions
     WHERE channel = 'whatsapp' AND identifier = $1 ORDER BY updated_at DESC LIMIT 1`,
    [identifier]
  );

  // Start fresh if there is no session, or the last one already finished.
  if (existing.rows.length === 0 || existing.rows[0].completed) {
    const created = await query(
      `INSERT INTO intake_sessions (channel, identifier, step, data)
       VALUES ('whatsapp', $1, 'org_code', '{}') RETURNING id, step, org_id, data, completed`,
      [identifier]
    );
    return created.rows[0];
  }
  return existing.rows[0];
}

async function saveSession(id: string, state: IntakeState, done: boolean): Promise<void> {
  await query(
    `UPDATE intake_sessions
       SET step = $2, org_id = $3, data = $4, completed = $5, updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      state.step,
      state.orgId || null,
      JSON.stringify({ orgName: state.orgName, fullName: state.fullName, gender: state.gender }),
      done,
    ]
  );
}

// Runs one conversational turn for a sender and returns what to reply.
async function processInbound(identifier: string, message: string): Promise<{ reply: string; done: boolean; step: IntakeStep }> {
  const session = await loadOrStartSession(identifier);
  const result = await advanceIntake(toState(session), message);

  if (result.done && result.state.step === 'done') {
    await createMemberFromIntake(result.state, { phone: identifier, channel: 'whatsapp' });
  }
  await saveSession(session.id, result.state, result.done);

  return { reply: result.reply, done: result.done, step: result.state.step };
}

// Sends a text message back through Meta's Graph API. Best-effort: if WhatsApp
// credentials are not configured, we skip the send (the simulate endpoint still
// returns the reply for testing).
async function sendWhatsappMessage(to: string, body: string): Promise<void> {
  if (!env.whatsappToken || !env.whatsappPhoneId) return;
  try {
    await fetch(`https://graph.facebook.com/v21.0/${env.whatsappPhoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });
  } catch (err) {
    console.error('WhatsApp send failed:', err);
  }
}

// Meta calls this once when you register the webhook URL.
export async function verifyWhatsapp(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'];
  const tokenParam = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && tokenParam === env.whatsappVerifyToken && env.whatsappVerifyToken) {
    res.status(200).send(String(challenge ?? ''));
    return;
  }
  res.sendStatus(403);
}

export async function handleWhatsappWebhook(req: Request, res: Response): Promise<void> {
  // Acknowledge immediately so Meta does not retry; processing follows.
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const messageObj = change?.value?.messages?.[0];
    if (!messageObj || messageObj.type !== 'text') return;

    const from: string = messageObj.from;
    const text: string = messageObj.text?.body || '';
    const { reply } = await processInbound(from, text);
    await sendWhatsappMessage(from, reply);
  } catch (err) {
    console.error('WhatsApp webhook processing failed:', err);
  }
}

// Channel-agnostic simulator used by the in-app Channels page so the WhatsApp
// flow can be tested end-to-end without a Meta account. Returns the reply in the
// HTTP response instead of sending it through Meta.
export async function simulateWhatsapp(req: Request, res: Response): Promise<void> {
  const from: string = (req.body?.from || '').trim();
  const message: string = req.body?.message ?? '';
  if (!from) {
    res.status(400).json({ error: 'A "from" phone number is required' });
    return;
  }
  const result = await processInbound(from, message);
  res.json(result);
}
