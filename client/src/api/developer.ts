import api from './client';
import type { ApiKey, NewApiKey, WebhookEndpoint, NewWebhookEndpoint, WebhookDelivery } from '../types';

// --- API keys ---
export async function listApiKeys(): Promise<ApiKey[]> {
  const res = await api.get('/developer/api-keys');
  return res.data;
}

export async function createApiKey(name: string): Promise<NewApiKey> {
  const res = await api.post('/developer/api-keys', { name });
  return res.data;
}

export async function revokeApiKey(id: string): Promise<void> {
  await api.delete(`/developer/api-keys/${id}`);
}

// --- Webhooks ---
export async function listWebhookEvents(): Promise<string[]> {
  const res = await api.get('/developer/events');
  return res.data.events;
}

export async function listWebhooks(): Promise<WebhookEndpoint[]> {
  const res = await api.get('/developer/webhooks');
  return res.data;
}

export async function createWebhook(data: { url: string; events: string[] }): Promise<NewWebhookEndpoint> {
  const res = await api.post('/developer/webhooks', data);
  return res.data;
}

export async function updateWebhook(
  id: string,
  data: Partial<{ url: string; events: string[]; active: boolean }>
): Promise<WebhookEndpoint> {
  const res = await api.patch(`/developer/webhooks/${id}`, data);
  return res.data;
}

export async function deleteWebhook(id: string): Promise<void> {
  await api.delete(`/developer/webhooks/${id}`);
}

export async function testWebhook(id: string): Promise<{ delivered: boolean }> {
  const res = await api.post(`/developer/webhooks/${id}/test`);
  return res.data;
}

export async function listWebhookDeliveries(id: string): Promise<WebhookDelivery[]> {
  const res = await api.get(`/developer/webhooks/${id}/deliveries`);
  return res.data;
}

// --- API console (real org-scoped data in the public-API shape) ---
export async function consoleQuery(
  endpoint: string,
  params: { limit?: number; offset?: number } = {}
): Promise<unknown> {
  const res = await api.get('/developer/console', { params: { endpoint, ...params } });
  return res.data;
}
