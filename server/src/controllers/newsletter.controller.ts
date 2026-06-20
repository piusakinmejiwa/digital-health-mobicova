import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { sendEmail } from '../lib/email';

// Welcome the new subscriber + notify the team. Best-effort: never throws, so a
// mail problem can't break the sign-up. Both no-op gracefully if email is unconfigured.
async function sendNewsletterEmails(d: { name: string; email: string; phone: string }): Promise<void> {
  const first = (d.name || '').split(' ')[0] || 'there';
  // 1) Welcome email to the subscriber
  try {
    await sendEmail({
      to: d.email,
      subject: 'Welcome to MobiCova — you’re subscribed',
      html: `<div style="font:15px/1.6 Arial,sans-serif;color:#1f2d2b">
        <h2 style="color:#0a7b7b">Welcome, ${first}! 🎉</h2>
        <p>Thanks for subscribing to MobiCova. We’ll send you occasional health tips, product news and updates — no spam.</p>
        <p>In the meantime, you can try our free <strong>Health Buddy</strong> for basic health questions, on any phone.</p>
        <p style="color:#5e6e6e;font-size:13px">You can unsubscribe any time by replying to this email.</p>
        <p style="color:#5e6e6e;font-size:13px">— The MobiCova Health team</p>
      </div>`,
      text: `Welcome, ${first}! Thanks for subscribing to MobiCova. We'll send occasional health tips, product news and updates. Unsubscribe any time by replying to this email. — MobiCova Health`,
    });
  } catch (err) {
    console.error('[newsletter] welcome email failed:', err);
  }
  // 2) Notification to the team inbox
  if (env.feedbackNotifyEmail) {
    try {
      await sendEmail({
        to: env.feedbackNotifyEmail,
        subject: `New newsletter subscriber — ${d.name || d.email}`,
        html: `<div style="font:14px Arial,sans-serif">New newsletter sign-up:<br><strong>${d.name || '—'}</strong><br>${d.email}<br>${d.phone || ''}</div>`,
        text: `New newsletter sign-up: ${d.name || '—'} / ${d.email} / ${d.phone || ''}`,
      });
    } catch (err) {
      console.error('[newsletter] notify email failed:', err);
    }
  }
}

// Public newsletter sign-up (home page). Upserts on email so re-subscribing just
// refreshes the contact details. Contact info only, no PHI.
export async function createNewsletterSignup(req: Request, res: Response): Promise<void> {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/.+@.+\..+/.test(email)) {
    res.status(400).json({ error: 'Enter a valid email address.' });
    return;
  }
  const name = String(req.body?.name || '').slice(0, 160);
  const phone = String(req.body?.phone || '').slice(0, 40);
  const consent = Boolean(req.body?.consent);

  await query(
    `INSERT INTO newsletter_signups (name, email, phone, consent)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, consent = EXCLUDED.consent`,
    [name, email.slice(0, 255), phone, consent]
  );

  // Welcome the subscriber + notify the team (best-effort; never blocks the response).
  await sendNewsletterEmails({ name, email, phone });

  res.status(201).json({ received: true });
}

export async function adminListNewsletterSignups(_req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT id, name, email, phone, consent, created_at FROM newsletter_signups ORDER BY created_at DESC LIMIT 5000`
  );
  res.json({ signups: r.rows, total: r.rows.length });
}
