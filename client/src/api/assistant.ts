import api from './client';

export type AssistantMessage = { role: 'user' | 'assistant'; content: string };
export type AssistantReply = {
  reply: string;
  safety: 'ok' | 'crisis' | 'emergency' | 'distress';
  handoff?: 'buddy';
};

// Public MobiCova Assistant — product/site Q&A. Sends the chosen UI language so it
// answers in that language as the locales come online.
export async function askAssistant(messages: AssistantMessage[], lang = 'en'): Promise<AssistantReply> {
  try {
    const { data } = await api.post<AssistantReply>('/assistant/chat', { messages, lang });
    return data;
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } };
    return { reply: e?.response?.data?.error || 'Sorry, something went wrong. Please try again.', safety: 'ok' };
  }
}
