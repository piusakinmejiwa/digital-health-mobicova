import { query } from '../config/database';

// White-label branding for an organisation's member-facing surfaces. Falls back
// to sensible defaults (the org name + MobiCova teal) when nothing is configured.
export interface OrgBranding {
  displayName: string;
  logoLetter: string;
  primaryColor: string;
  accentColor: string;
  supportContact: string;
  whatsappGreeting: string;
}

export async function getOrgBranding(orgId: string): Promise<OrgBranding> {
  const [b, org] = await Promise.all([
    query('SELECT * FROM org_branding WHERE org_id = $1', [orgId]),
    query('SELECT name FROM organisations WHERE id = $1', [orgId]),
  ]);
  const orgName: string = org.rows[0]?.name || 'MobiCova';
  const row = b.rows[0];
  return {
    displayName: row?.display_name || orgName,
    logoLetter: row?.logo_letter || orgName.charAt(0).toUpperCase(),
    primaryColor: row?.primary_color || '#0a7b7b',
    accentColor: row?.accent_color || '#12a3a3',
    supportContact: row?.support_contact || '',
    whatsappGreeting: row?.whatsapp_greeting || '',
  };
}
