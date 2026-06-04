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
