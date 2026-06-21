import api from './client';

export type HealthTipChannel = 'sms' | 'whatsapp' | 'email';

export interface HealthTipSubscribeInput {
  fullName: string;
  smsNumber?: string;
  whatsappNumber?: string;
  email?: string;
  channels: HealthTipChannel[];
  consent: boolean;
}

// --- Public ---
export async function subscribeHealthTips(data: HealthTipSubscribeInput): Promise<{ channels: HealthTipChannel[] }> {
  return (await api.post('/health-tips/subscribe', data)).data;
}

export async function unsubscribeHealthTips(token: string): Promise<{ unsubscribed: boolean }> {
  return (await api.post('/health-tips/unsubscribe', { token })).data;
}

// --- Admin ---
export interface HealthTipSubscriber {
  id: string; full_name: string; sms_number: string; whatsapp_number: string;
  email: string; channels: HealthTipChannel[]; consent: boolean; is_active: boolean; created_at: string;
}
export interface HealthTip {
  id: string; seq: number; title: string; body: string; category: string; is_active: boolean; created_at: string;
}
export interface HealthTipSend {
  id: string; channel: string; status: string; error: string; sent_on: string;
  created_at: string; full_name: string; tip_title: string;
}
export interface HealthTipSendSummary {
  tip: { id: string; title: string } | null;
  subscribers: number;
  sent: Record<string, number>;
  failed: Record<string, number>;
  skipped: number;
  configured: { email: boolean; sms: boolean; whatsapp: boolean };
}

export async function adminListHealthSubscribers(): Promise<{ subscribers: HealthTipSubscriber[]; total: number }> {
  return (await api.get('/admin/health-tips/subscribers')).data;
}
export async function adminDeleteHealthSubscriber(id: string): Promise<void> {
  await api.delete(`/admin/health-tips/subscribers/${id}`);
}
export async function adminListHealthTips(): Promise<{ tips: HealthTip[] }> {
  return (await api.get('/admin/health-tips/tips')).data;
}
export async function adminCreateHealthTip(data: { title: string; body: string; category?: string }): Promise<HealthTip> {
  return (await api.post('/admin/health-tips/tips', data)).data;
}
export async function adminUpdateHealthTip(id: string, data: Partial<Pick<HealthTip, 'title' | 'body' | 'category' | 'is_active'>>): Promise<HealthTip> {
  return (await api.patch(`/admin/health-tips/tips/${id}`, data)).data;
}
export async function adminDeleteHealthTip(id: string): Promise<void> {
  await api.delete(`/admin/health-tips/tips/${id}`);
}
export async function adminListHealthTipSends(): Promise<{ sends: HealthTipSend[] }> {
  return (await api.get('/admin/health-tips/sends')).data;
}
export async function adminSendHealthTipNow(): Promise<HealthTipSendSummary> {
  return (await api.post('/admin/health-tips/send-now')).data;
}
