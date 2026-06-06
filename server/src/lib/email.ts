import { env } from '../config/env';

// Transactional email with graceful degradation. With no RESEND_API_KEY set, we
// log the message instead of sending (demo mode) and never throw — callers can
// fire-and-forget without risking the request. Switch to real delivery by
// setting RESEND_API_KEY + a verified EMAIL_FROM.

export interface SendResult { sent: boolean; error?: string }

export async function sendEmail(msg: {
  to: string; subject: string; html: string; text?: string;
}): Promise<SendResult> {
  if (!env.resendApiKey) {
    console.log(`[email:demo] to=${msg.to} · subject="${msg.subject}" (RESEND_API_KEY not set — not sent)`);
    return { sent: false, error: 'no-provider' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend error ${res.status}: ${body}`);
      return { sent: false, error: `resend-${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('[email] send failed:', err);
    return { sent: false, error: 'exception' };
  }
}
