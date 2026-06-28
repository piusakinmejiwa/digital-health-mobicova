import api from './client';
import type { OrgBranding } from '../types';

export async function getBranding(): Promise<OrgBranding> {
  const res = await api.get('/settings/branding');
  return res.data;
}

export async function updateBranding(data: OrgBranding): Promise<OrgBranding> {
  const res = await api.put('/settings/branding', data);
  return res.data;
}

// Upload a logo image (admin) → returns its public URL.
export async function uploadBrandingLogo(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('image', file);
  return (await api.post('/settings/branding/logo', form)).data;
}
