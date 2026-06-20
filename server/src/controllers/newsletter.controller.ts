import { Request, Response } from 'express';
import { query } from '../config/database';

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
  res.status(201).json({ received: true });
}

export async function adminListNewsletterSignups(_req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT id, name, email, phone, consent, created_at FROM newsletter_signups ORDER BY created_at DESC LIMIT 5000`
  );
  res.json({ signups: r.rows, total: r.rows.length });
}
