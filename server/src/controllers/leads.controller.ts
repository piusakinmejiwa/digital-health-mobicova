import { Request, Response } from 'express';
import { query } from '../config/database';

// Public "Book a demo" lead capture from the marketing site. Unauthenticated;
// stores contact details only (no PHI) for the sales team to follow up.
export async function createLead(req: Request, res: Response): Promise<void> {
  const email = String(req.body?.email || '').trim();
  if (!/.+@.+\..+/.test(email)) {
    res.status(400).json({ error: 'Enter a valid work email.' });
    return;
  }
  const company = String(req.body?.company || '').slice(0, 160);
  const partnerType = String(req.body?.partnerType || '').slice(0, 60);
  const memberBand = String(req.body?.memberBand || '').slice(0, 40);

  await query(
    `INSERT INTO demo_leads (email, company, partner_type, member_band)
     VALUES ($1, $2, $3, $4)`,
    [email.slice(0, 255), company, partnerType, memberBand]
  );

  res.status(201).json({ received: true });
}
