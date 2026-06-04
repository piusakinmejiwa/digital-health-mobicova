import api from './client';
import type { InboxData } from '../types';

export async function getInbox(): Promise<InboxData> {
  const res = await api.get('/inbox');
  return res.data;
}

export async function markInboxRead(keys: string[]): Promise<void> {
  await api.post('/inbox/read', { keys });
}
