import api from './client';
import type { SsoConfig } from '../types';

export interface SsoConfigInput {
  enabled: boolean;
  entryPoint: string;
  idpIssuer: string;
  idpCert: string;
  emailAttribute: string;
}

// The API origin a browser navigates to for the SP-initiated SSO redirect.
// Mirrors the axios baseURL (includes the /api/v1 prefix).
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// Org-admin self-service config (the signed-in admin's own org).
export async function getMySso(): Promise<SsoConfig> {
  return (await api.get('/sso/config')).data;
}
export async function updateMySso(data: SsoConfigInput): Promise<SsoConfig> {
  return (await api.put('/sso/config', data)).data;
}

// Public: does this workspace slug have SSO enabled?
export async function ssoStatus(slug: string): Promise<{ enabled: boolean; slug?: string; orgName?: string }> {
  return (await api.get('/auth/sso/status', { params: { slug } })).data;
}

// Full browser navigation to begin SP-initiated login for a workspace.
export function beginSso(slug: string): void {
  window.location.href = `${API_BASE}/auth/saml/${encodeURIComponent(slug)}/login`;
}
