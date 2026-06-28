import api from './client';

// Public branding for an org's branded login page (/o/<slug>/login).
export interface OrgBrandingPublic {
  slug: string;
  displayName: string;
  logoLetter: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
}

export async function getOrgBrandingBySlug(slug: string): Promise<OrgBrandingPublic> {
  return (await api.get(`/orgs/${slug}/branding`)).data;
}
