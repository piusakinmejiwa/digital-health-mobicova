import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { sendEmail } from '../lib/email';

// Public contact form capture (/contact). Stores the enquiry and best-effort
// emails a copy to the configured inbox. Contact details only, no PHI.

async function notify(d: Record<string, string>): Promise<void> {
  if (!env.feedbackNotifyEmail) return;
  try {
    const row = (k: string, v: string) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#5e6e6e">${k}</td><td style="padding:4px 0"><strong>${v || '—'}</strong></td></tr>`;
    const html = `
      <h2 style="color:#0a7b7b;margin:0 0 12px">New contact-form message</h2>
      <table style="border-collapse:collapse;font:14px Arial,sans-serif">
        ${row('Name', d.name)}${row('Email', d.email)}${row('Phone', d.phone)}
        ${row('Organisation', d.organisation)}${row('Enquiry type', d.enquiryType)}${row('Subject', d.subject)}
      </table>
      <p style="font:14px Arial,sans-serif;white-space:pre-wrap">${d.message}</p>`;
    await sendEmail({
      to: env.feedbackNotifyEmail,
      subject: `New contact message — ${d.name || d.email}`,
      html,
      text: `From: ${d.name} <${d.email}> ${d.phone}\nOrg: ${d.organisation}\nType: ${d.enquiryType}\nSubject: ${d.subject}\n\n${d.message}`,
    });
  } catch (err) {
    console.error('[contact] notify email failed:', err);
  }
}

export async function createContactMessage(req: Request, res: Response): Promise<void> {
  const email = String(req.body?.email || '').trim();
  if (!/.+@.+\..+/.test(email)) {
    res.status(400).json({ error: 'Enter a valid email.' });
    return;
  }
  const name = String(req.body?.name || '').slice(0, 160);
  const phone = String(req.body?.phone || '').slice(0, 40);
  const organisation = String(req.body?.organisation || '').slice(0, 160);
  const enquiryType = String(req.body?.enquiryType || '').slice(0, 40);
  const subject = String(req.body?.subject || '').slice(0, 200);
  const message = String(req.body?.message || '').slice(0, 4000);
  const consent = Boolean(req.body?.consent);

  await query(
    `INSERT INTO contact_messages (name, email, phone, organisation, enquiry_type, subject, message, consent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [name, email.slice(0, 255), phone, organisation, enquiryType, subject, message, consent]
  );

  await notify({ name, email, phone, organisation, enquiryType, subject, message });
  res.status(201).json({ received: true });
}

export async function adminListContactMessages(_req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT id, name, email, phone, organisation, enquiry_type, subject, message, consent, created_at
       FROM contact_messages ORDER BY created_at DESC LIMIT 1000`
  );
  res.json({ messages: r.rows, total: r.rows.length });
}
