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
