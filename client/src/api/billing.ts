import api from './client';
import type { BillingAccount } from '../types';

export async function getBillingAccount(): Promise<BillingAccount> {
  const res = await api.get('/billing/account');
  return res.data;
}

export async function changePlan(tier: string): Promise<{ plan: { key: string; name: string } }> {
  const res = await api.post('/billing/account/plan', { tier });
  return res.data;
}

// Live usage vs plan limits (lightweight — no invoices). Powers the dashboard
// usage widget and the member create/import "seats remaining" hints.
export interface UsageItem {
  key: 'members' | 'webhooks' | 'intake' | string;
  label: string;
  used: number;
  limit: number;
  hard: boolean;
  unlimited: boolean;
  pct: number;
}
export interface OrgUsage {
  plan: { key: string; name: string };
  usage: UsageItem[];
}
export async function getUsage(): Promise<OrgUsage> {
  const res = await api.get('/billing/usage');
  return res.data;
}
