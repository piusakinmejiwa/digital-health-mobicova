import { env } from '../config/env';

// Outbound SMS + WhatsApp senders for Daily Health Tips. Each is independently
// gated: if its credentials are absent, *Configured() is false and the channel
// is skipped gracefully (the tip still goes out on the other channels). Email is
// handled separately by lib/email.ts (Resend).

export type SendOutcome = { ok: boolean; error?: string };

// ── SMS (Africa's Talking) ────────────────────────────────────────────────
// Reuses the AT_USERNAME / AT_API_KEY you already have for USSD/WhatsApp. No
// voice number needed, so this can go live well before Phase 2 voice.
export function smsConfigured(): boolean {
  return !!(env.atUsername && env.atApiKey);
}

export async function sendSms(to: string, message: string): Promise<SendOutcome> {
  if (!smsConfigured()) return { ok: false, error: 'SMS not configured' };
  const host = env.atSandbox
    ? 'https://api.sandbox.africastalking.com'
    : 'https://api.africastalking.com';
  const body = new URLSearchParams({ username: env.atUsername, to, message });
  if (env.atSmsSender) body.set('from', env.atSmsSender);
  try {
    const res = await fetch(`${host}/version1/messaging`, {
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
    const recipients = json?.SMSMessageData?.Recipients;
    const status = recipients?.[0]?.status;
    if (!res.ok || (status && !/success/i.test(status))) {
      return { ok: false, error: `AT SMS (${res.status}): ${status || text.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ── WhatsApp (Meta Cloud API) ─────────────────────────────────────────────
// Business-initiated messages (a daily tip the user didn't just reply to) must
// use an APPROVED template. We send the tip text as the template's body
// parameter. Gated until the token + phone-number id + template name are set.
export function whatsappConfigured(): boolean {
  return !!(env.whatsappToken && env.whatsappPhoneId && env.whatsappTemplate);
}

export async function sendWhatsApp(to: string, message: string): Promise<SendOutcome> {
  if (!whatsappConfigured()) return { ok: false, error: 'WhatsApp not configured' };
  const url = `https://graph.facebook.com/v21.0/${env.whatsappPhoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: to.replace(/[^\d+]/g, ''),
    type: 'template',
    template: {
      name: env.whatsappTemplate,
      language: { code: env.whatsappLang },
      components: [{ type: 'body', parameters: [{ type: 'text', text: message }] }],
    },
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
    if (!res.ok) {
      return { ok: false, error: `WhatsApp (${res.status}): ${json?.error?.message || text.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
