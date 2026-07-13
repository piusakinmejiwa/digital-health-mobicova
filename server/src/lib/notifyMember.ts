// Member messaging dispatcher — one place every outbound member message flows
// through, with an explicit channel priority + graceful fallback. This is what
// keeps WhatsApp/USSD as a strength rather than a single point of failure: if
// WhatsApp is unconfigured (e.g. Meta hasn't approved a template yet) or a send
// fails, the same message drops to the next available rail (SMS, then email).
//
// Two modes:
//   • reachOnce  — deliver the message ONCE; try channels in `order` and stop at
//                  the first success. For alerts/reminders that must arrive.
//   • broadcast  — send on every channel the member opted into (in `channels`).
//                  For opt-in streams like Daily Health Tips.
//
// WhatsApp is business-initiated here, so it always uses an approved TEMPLATE.
// SMS and email are free-form.

import { env } from '../config/env';
import { sendSms, sendWhatsAppTemplate, smsConfigured, whatsappConfigured } from './messaging';
import { sendEmail } from './email';

export type MemberChannel = 'whatsapp' | 'sms' | 'email';
export const MEMBER_CHANNELS: MemberChannel[] = ['whatsapp', 'sms', 'email'];

export interface MemberContact {
  phone?: string;      // SMS destination
  whatsapp?: string;   // WhatsApp destination (often the same number)
  email?: string;
}

export interface WhatsAppContent { template: string; params?: string[]; lang?: string; }
export interface EmailContent { subject: string; html: string; text: string; }

// The same logical message, rendered for each channel it can ride. `sms` is
// required so there is always a text fallback; whatsapp/email are optional.
export interface MemberMessage {
  sms: string;
  whatsapp?: WhatsAppContent;
  email?: EmailContent;
}

export interface NotifyMemberOptions {
  mode?: 'reachOnce' | 'broadcast';   // default reachOnce
  order?: MemberChannel[];            // priority order (default whatsapp→sms→email)
  channels?: MemberChannel[];         // restrict to these (e.g. the member's opted-in set)
}

export interface AttemptResult { channel: MemberChannel; ok: boolean; error?: string }
export interface NotifyMemberResult {
  via: MemberChannel | null;          // first channel that delivered (null if none)
  delivered: MemberChannel[];
  attempted: AttemptResult[];
}

// A channel is usable only if it's configured, the member has a destination for it,
// and the message has a rendering for it. "Unconfigured" and "no destination" are
// treated the same as a failure would be — we simply move to the next rail.
export function channelAvailable(ch: MemberChannel, c: MemberContact, m: MemberMessage): boolean {
  if (ch === 'whatsapp') return whatsappConfigured() && !!c.whatsapp && !!m.whatsapp;
  if (ch === 'sms') return smsConfigured() && !!c.phone && !!m.sms;
  return !!env.resendApiKey && !!c.email && !!m.email;
}

async function deliverChannel(ch: MemberChannel, c: MemberContact, m: MemberMessage): Promise<AttemptResult> {
  try {
    if (ch === 'whatsapp') {
      const w = m.whatsapp!;
      const r = await sendWhatsAppTemplate(c.whatsapp!, w.template, w.params ?? [], w.lang);
      return { channel: ch, ok: r.ok, error: r.error };
    }
    if (ch === 'sms') {
      const r = await sendSms(c.phone!, m.sms);
      return { channel: ch, ok: r.ok, error: r.error };
    }
    const e = m.email!;
    const r = await sendEmail({ to: c.email!, subject: e.subject, html: e.html, text: e.text });
    return { channel: ch, ok: r.sent, error: r.error };
  } catch (err) {
    return { channel: ch, ok: false, error: (err as Error).message };
  }
}

// Deliver a member message with fallback. Never throws — callers can fire-and-forget.
export async function notifyMember(
  contact: MemberContact, message: MemberMessage, opts: NotifyMemberOptions = {},
): Promise<NotifyMemberResult> {
  const mode = opts.mode ?? 'reachOnce';
  const order = opts.order ?? MEMBER_CHANNELS;
  const allow = opts.channels ? new Set(opts.channels) : null;

  const attempted: AttemptResult[] = [];
  const delivered: MemberChannel[] = [];

  for (const ch of order) {
    if (allow && !allow.has(ch)) continue;
    if (!channelAvailable(ch, contact, message)) continue;
    const res = await deliverChannel(ch, contact, message);
    attempted.push(res);
    if (res.ok) {
      delivered.push(ch);
      if (mode === 'reachOnce') return { via: ch, delivered, attempted };
    }
  }
  return { via: delivered[0] ?? null, delivered, attempted };
}
