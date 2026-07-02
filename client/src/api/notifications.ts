import api from './client';

export interface Notification {
  id: string; category: string; severity: 'info' | 'warn' | 'critical' | string;
  title: string; body: string; href: string; created_at: string; read: boolean;
}
export interface NotificationFeed { items: Notification[]; unread: number; }
export interface CategoryMeta { key: string; label: string; description: string; }
export interface NotificationPrefs {
  categories: CategoryMeta[]; muted: string[]; email: string[]; hasPrefs: boolean;
}

export async function getNotifications(limit = 30): Promise<NotificationFeed> {
  return (await api.get('/notifications', { params: { limit } })).data;
}
export async function markNotificationsRead(ids: string[]): Promise<void> {
  await api.post('/notifications/read', { ids });
}
export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all', {});
}
export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  return (await api.get('/notifications/prefs')).data;
}
export async function updateNotificationPrefs(muted: string[], email: string[]): Promise<{ muted: string[]; email: string[] }> {
  return (await api.put('/notifications/prefs', { muted, email })).data;
}

// --- Per-org Slack integration ---
export interface SlackConfig {
  categories: CategoryMeta[]; connected: boolean; active: boolean; enabled: string[]; urlHint: string;
}
export async function getSlackConfig(): Promise<SlackConfig> {
  return (await api.get('/notifications/slack')).data;
}
export async function updateSlackConfig(data: { webhookUrl?: string; active?: boolean; categories?: string[] }): Promise<{ connected: boolean; active: boolean; categories: string[] }> {
  return (await api.put('/notifications/slack', data)).data;
}
export async function testSlack(): Promise<void> {
  await api.post('/notifications/slack/test', {});
}

// "2h ago" style relative time, kept tiny and dependency-free.
export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
