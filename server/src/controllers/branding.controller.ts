import { Request, Response } from 'express';
import { query } from '../config/database';
import { recordAudit } from '../lib/audit';
import { getOrgBranding } from '../lib/branding';

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function hex(v: unknown, fallback: string): string {
  const s = String(v ?? '').trim();
  return HEX.test(s) ? s : fallback;
}

// GET /settings/branding — effective branding (with defaults). Open to all roles.
export async function getBranding(req: Request, res: Response): Promise<void> {
  res.json(await getOrgBranding(req.user!.orgId));
}

// PUT /settings/branding — upsert the org's branding (admin only).
export async function updateBranding(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const cur = await getOrgBranding(orgId);

  const displayName = String(req.body?.displayName ?? cur.displayName).slice(0, 120);
  const logoLetter = String(req.body?.logoLetter ?? cur.logoLetter).slice(0, 4);
  const primary = hex(req.body?.primaryColor, cur.primaryColor);
  const accent = hex(req.body?.accentColor, cur.accentColor);
  const support = String(req.body?.supportContact ?? cur.supportContact).slice(0, 160);
  const greeting = String(req.body?.whatsappGreeting ?? cur.whatsappGreeting).slice(0, 1000);

  await query(
    `INSERT INTO org_branding
       (org_id, display_name, logo_letter, primary_color, accent_color, support_contact, whatsapp_greeting, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (org_id) DO UPDATE SET
       display_name = $2, logo_letter = $3, primary_color = $4, accent_color = $5,
       support_contact = $6, whatsapp_greeting = $7, updated_at = NOW()`,
    [orgId, displayName, logoLetter, primary, accent, support, greeting]
  );

  await recordAudit(req, { action: 'branding.update', targetType: 'organisation', targetId: orgId, orgId });
  res.json(await getOrgBranding(orgId));
}
