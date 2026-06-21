import { env } from '../config/env';

// Masked phone calls (Phase 2). Provider-agnostic so Africa's Talking ↔ Twilio
// is a config change, not a rewrite (same pattern as the image-gen layer).
//
// Flow (click-to-call bridge): we originate a call to the MEMBER from the
// MobiCova masking number; when they answer, the provider hits our voice
// callback and we return an instruction to dial the DOCTOR — both legs show only
// the MobiCova number, so neither party sees the other's real number.
//
// Gated on credentials: voiceConfigured() ⇒ false hides "Call my phone" and the
// endpoints return a graceful 503. AT_SANDBOX=true + AT_USERNAME=sandbox lets us
// build/test before a production voice number clears.

export function voiceConfigured(): boolean {
  if (env.voiceProvider === 'africastalking') {
    return !!(env.atUsername && env.atApiKey && env.atVoiceNumber);
  }
  if (env.voiceProvider === 'twilio') {
    return !!(env.twilioAccountSid && env.twilioAuthToken && env.twilioVoiceNumber);
  }
  return false;
}

// The masking number both parties see on caller ID.
export function maskingNumber(): string {
  if (env.voiceProvider === 'twilio') return env.twilioVoiceNumber;
  return env.atVoiceNumber;
}

// Originate a call to `to` (E.164, e.g. +234…) from the masking number.
// Returns a provider call/session reference we store on the consultation so the
// answer-callback can match it back to the right doctor.
export async function originateCall(to: string): Promise<{ ref: string; raw: any }> {
  if (env.voiceProvider === 'africastalking') return atOriginate(to);
  if (env.voiceProvider === 'twilio') return twilioOriginate(to);
  throw new Error(`Unknown VOICE_PROVIDER "${env.voiceProvider}"`);
}

// Call-control XML returned when the member answers: greet, then bridge to the
// doctor with the masking number as caller ID. Recording off by default. The
// dialect differs by provider — Africa's Talking uses <Dial phoneNumbers=…/>,
// Twilio uses <Dial callerId><Number>…</Number></Dial> (TwiML).
export function bridgeInstruction(doctorNumber: string, record = false): string {
  const head = '<?xml version="1.0" encoding="UTF-8"?>';
  const say = 'Connecting you to your MobiCova doctor now. Please hold.';
  if (env.voiceProvider === 'twilio') {
    const rec = record ? ' record="record-from-answer-dual"' : '';
    return head +
      '<Response>' +
      `<Say voice="alice">${say}</Say>` +
      `<Dial callerId="${maskingNumber()}"${rec} timeLimit="3600"><Number>${doctorNumber}</Number></Dial>` +
      '</Response>';
  }
  return head +
    '<Response>' +
    `<Say voice="woman">${say}</Say>` +
    `<Dial phoneNumbers="${doctorNumber}" record="${record ? 'true' : 'false'}" ` +
    `callerId="${maskingNumber()}" maxDuration="3600"/>` +
    '</Response>';
}

// Polite hang-up XML when we can't match a call to a consultation.
export function endInstruction(message = 'Sorry, we could not connect your call. Please try again later.'): string {
  const head = '<?xml version="1.0" encoding="UTF-8"?>';
  if (env.voiceProvider === 'twilio') {
    return `${head}<Response><Say voice="alice">${message}</Say><Hangup/></Response>`;
  }
  return `${head}<Response><Say voice="woman">${message}</Say><Reject/></Response>`;
}

// ── Africa's Talking ──────────────────────────────────────────────────────
async function atOriginate(to: string): Promise<{ ref: string; raw: any }> {
  const host = env.atSandbox
    ? 'https://voice.sandbox.africastalking.com'
    : 'https://voice.africastalking.com';
  const body = new URLSearchParams({ username: env.atUsername, from: env.atVoiceNumber, to });
  const res = await fetch(`${host}/call`, {
    method: 'POST',
    headers: {
      apiKey: env.atApiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  const entry = json?.entries?.[0];
  // AT returns errorMessage:'None' on success; entries[].status is 'Queued'.
  if (!res.ok || (json?.errorMessage && json.errorMessage !== 'None') || (entry && entry.status && !/queued|success/i.test(entry.status))) {
    throw new Error(`Africa's Talking call failed (${res.status}): ${json?.errorMessage || entry?.status || text.slice(0, 200)}`);
  }
  return { ref: entry?.sessionId || '', raw: json };
}

// ── Twilio ────────────────────────────────────────────────────────────────
// Twilio fetches a TwiML URL when the member answers (rather than calling a
// fixed dashboard URL like AT). We point that URL — and the status callback —
// at our existing /voice/callback and /voice/event endpoints, which already
// match the call by its provider id (Twilio's CallSid) and return the Twilio
// XML dialect. So both providers share the same two webhooks.
async function twilioOriginate(to: string): Promise<{ ref: string; raw: any }> {
  const base = env.serverUrl; // must be the public API origin in production
  const tk = env.atWebhookToken ? `?token=${encodeURIComponent(env.atWebhookToken)}` : '';
  const body = new URLSearchParams({
    From: env.twilioVoiceNumber,
    To: to,
    Url: `${base}/api/v1/voice/callback${tk}`,
    Method: 'POST',
    StatusCallback: `${base}/api/v1/voice/event${tk}`,
    StatusCallbackMethod: 'POST',
  });
  body.append('StatusCallbackEvent', 'completed');

  const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Calls.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    }
  );
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  if (!res.ok) {
    throw new Error(`Twilio call failed (${res.status}): ${json?.message || text.slice(0, 200)}`);
  }
  return { ref: json?.sid || '', raw: json };
}
