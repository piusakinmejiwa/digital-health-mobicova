import api from './client';

export type BuddySource = { name: string; url: string; title: string };
export type BuddyMessage = { role: 'user' | 'assistant'; content: string };
export type BuddySafety = 'ok' | 'crisis' | 'emergency' | 'distress';
export type BuddyReply = {
  reply: string;
  sources: BuddySource[];
  safety: BuddySafety;
};

const KEY = 'mobicova_buddy_session';

// Anonymous, persistent client id for the free buddy (rate-limit + history).
export function buddySessionKey(): string {
  let k = localStorage.getItem(KEY);
  if (!k) {
    k = (crypto.randomUUID?.() || `b_${Date.now()}_${Math.round(Math.random() * 1e9)}`).replace(/-/g, '');
    localStorage.setItem(KEY, k);
  }
  return k;
}

export async function chatWithBuddy(messages: BuddyMessage[], specialty = 'general', lang = 'en'): Promise<BuddyReply> {
  try {
    const { data } = await api.post<BuddyReply>('/buddy/chat', {
      messages,
      specialty,
      lang, // server answers in this language (e.g. 'pcm'); defaults to English
      sessionKey: buddySessionKey(),
    });
    return data;
  } catch (err: any) {
    // Daily-limit response carries a friendly reply.
    const d = err?.response?.data;
    if (d?.reply) return { reply: d.reply, sources: [], safety: 'ok' };
    throw err;
  }
}
