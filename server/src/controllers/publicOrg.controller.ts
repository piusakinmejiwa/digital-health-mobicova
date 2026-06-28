import { Request, Response } from 'express';
import { query } from '../config/database';
import { getOrgBranding } from '../lib/branding';

// PUBLIC (unauthenticated) — branding for an org's branded login page
// (/o/<slug>/login). Returns only display name + logo letter + colours, never
// anything sensitive. 404 if the slug is unknown or the org is suspended.
export async function getPublicOrgBranding(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug || '').toLowerCase();
  const org = await query(
    'SELECT id FROM organisations WHERE slug = $1 AND is_active = true',
    [slug]
  );
  if (org.rows.length === 0) {
    res.status(404).json({ error: 'Organisation not found' });
    return;
  }
  const b = await getOrgBranding(org.rows[0].id);
  res.json({
    slug,
    displayName: b.displayName,
    logoLetter: b.logoLetter,
    logoUrl: b.logoUrl,
    primaryColor: b.primaryColor,
    accentColor: b.accentColor,
  });
}
