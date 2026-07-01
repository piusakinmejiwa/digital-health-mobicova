import { Request, Response } from 'express';
import { createHmac } from 'crypto';
import { query } from '../config/database';
import { env } from '../config/env';
import { constantTimeEqual } from '../lib/safeCompare';
import {
  advanceIntake, createMemberFromIntake, initialIntakeState, INTAKE_INTRO, IntakeState, IntakeStep,
} from '../services/intake.service';
import { answerBuddy } from '../services/buddy.service';
import { findMemberByPhone, memberMenu, handleMemberChoice } from '../lib/memberServices';

// WhatsApp greeting adds buddy discoverability (INTAKE_INTRO itself is shared with
// USSD, so we keep it untouched and only extend the greeting here).
const WA_GREETING = `${INTAKE_INTRO}\n\nOr reply *BUDDY* followed by a question to chat with our free Health Buddy (basic health info from trusted sources).`;
const BUDDY_WELCOME = 'Hi! I can share basic health info from trusted sources. Ask me a question (e.g. "what helps a fever?"). I\'m not a doctor — reply MENU any time to register or talk to one.';
const BUDDY_DAILY_LIMIT = Number(process.env.BUDDY_DAILY_LIMIT || 20);
const BUDDY_EXIT = new Set(['MENU', 'REGISTER', 'ENROL', 'ENROLL', 'STOP', 'EXIT', 'BACK']);

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
  mode: 'intake' | 'buddy' | 'member';
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

async function loadOrStartSession(identifier: string): Promise<{ session: StoredSession; isNew: boolean }> {
  const existing = await query(
    `SELECT id, step, org_id, data, completed, mode FROM intake_sessions
     WHERE channel = 'whatsapp' AND identifier = $1 ORDER BY updated_at DESC LIMIT 1`,
    [identifier]
  );

  // Start fresh if there is no session, or the last one already finished.
  if (existing.rows.length === 0 || existing.rows[0].completed) {
    const created = await query(
      `INSERT INTO intake_sessions (channel, identifier, step, data)
       VALUES ('whatsapp', $1, 'org_code', '{}') RETURNING id, step, org_id, data, completed, mode`,
      [identifier]
    );
    return { session: created.rows[0], isNew: true };
  }
  return { session: existing.rows[0], isNew: false };
}

async function setSessionMode(id: string, mode: 'intake' | 'buddy' | 'member'): Promise<void> {
  await query(`UPDATE intake_sessions SET mode = $2, updated_at = NOW() WHERE id = $1`, [id, mode]);
}

// Leaving the buddy → restart a clean intake session.
async function resetToIntake(id: string): Promise<void> {
  await query(
    `UPDATE intake_sessions SET mode = 'intake', step = 'org_code', org_id = NULL,
       data = '{}', completed = false, updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

// One buddy turn over WhatsApp: enforce the free daily cap, answer (grounded +
// safety-filtered), log for review, and format for a chat message.
async function buddyTurn(identifier: string, message: string): Promise<string> {
  const usage = await query(
    `INSERT INTO buddy_usage (session_key, day, count) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (session_key, day) DO UPDATE SET count = buddy_usage.count + 1 RETURNING count`,
    [identifier.slice(0, 80)]
  );
  if (usage.rows[0].count > BUDDY_DAILY_LIMIT) {
    return `You've reached today's free limit of ${BUDDY_DAILY_LIMIT} questions. Please come back tomorrow — or reply MENU to register and talk to a MobiCova doctor.`;
  }

  const ans = await answerBuddy([{ role: 'user', content: message.slice(0, 2000) }]);
  try {
    await query(
      `INSERT INTO buddy_messages (session_key, channel, role, content, safety) VALUES ($1,'whatsapp','user',$2,$3)`,
      [identifier.slice(0, 80), message.slice(0, 2000), ans.safety]
    );
    await query(
      `INSERT INTO buddy_messages (session_key, channel, role, content, safety, sources) VALUES ($1,'whatsapp','assistant',$2,$3,$4::jsonb)`,
      [identifier.slice(0, 80), ans.reply, ans.safety, JSON.stringify(ans.sources)]
    );
  } catch (err) {
    console.error('Buddy WhatsApp log failed (non-fatal):', err);
  }

  let out = ans.reply;
  if (ans.sources.length) out += `\n\nSources: ${ans.sources.map((s) => s.name).join(', ')}`;
  if (ans.safety === 'ok') out += '\n\n(Reply MENU to register, or ask another question.)';
  return out;
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
  const { session, isNew } = await loadOrStartSession(identifier);
  const cmd = message.trim().toUpperCase();

  // Enter the Health Buddy from anywhere with "BUDDY [question]".
  if (cmd === 'BUDDY' || cmd.startsWith('BUDDY ')) {
    await setSessionMode(session.id, 'buddy');
    const q = message.trim().slice('BUDDY'.length).trim();
    if (!q) return { reply: BUDDY_WELCOME, done: false, step: session.step };
    return { reply: await buddyTurn(identifier, q), done: false, step: session.step };
  }

  // Continue an active buddy conversation (MENU/REGISTER returns to enrolment).
  if (session.mode === 'buddy') {
    if (BUDDY_EXIT.has(cmd)) {
      await resetToIntake(session.id);
      return { reply: WA_GREETING, done: false, step: 'org_code' };
    }
    return { reply: await buddyTurn(identifier, message), done: false, step: session.step };
  }

  // Known member → self-service (identified by their WhatsApp number). Numeric
  // replies run an action; anything else shows the menu. Buddy is still reachable
  // via the BUDDY command above.
  const member = await findMemberByPhone(identifier);
  if (member) {
    await setSessionMode(session.id, 'member');
    if (['1', '2', '3', '4', '5'].includes(cmd)) {
      const out = await handleMemberChoice(member, cmd, 'whatsapp');
      return { reply: `${out ?? 'Sorry, please try again.'}\n\nReply MENU for options, or BUDDY <question>.`, done: false, step: session.step };
    }
    return { reply: memberMenu(member.full_name), done: false, step: session.step };
  }

  // First contact: greet with instructions instead of consuming the opening
  // message ("Hi") as an organisation code. The next message is the code.
  if (isNew) {
    return { reply: WA_GREETING, done: false, step: session.step };
  }

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
  // Verify Meta's X-Hub-Signature-256 (HMAC-SHA256 of the RAW body with the App
  // Secret) before trusting the payload. This path is served express.raw(), so
  // req.body is the unparsed Buffer. Fail closed when the secret isn't set — an
  // unauthenticated payload could otherwise enrol members and spoof sessions.
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!env.whatsappAppSecret) {
    console.warn('[whatsapp] inbound webhook rejected — WHATSAPP_APP_SECRET not set');
    res.sendStatus(401);
    return;
  }
  const header = String(req.headers['x-hub-signature-256'] || '');
  const expected = `sha256=${createHmac('sha256', env.whatsappAppSecret).update(raw).digest('hex')}`;
  if (!header || !constantTimeEqual(header, expected)) {
    res.sendStatus(401);
    return;
  }

  // Acknowledge immediately so Meta does not retry; processing follows.
  res.sendStatus(200);

  try {
    const payload = JSON.parse(raw.toString('utf8'));
    const entry = payload?.entry?.[0];
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
