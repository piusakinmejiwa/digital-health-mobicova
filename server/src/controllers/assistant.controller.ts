import { Request, Response } from 'express';
import { answerAssistant, AssistantMessage } from '../services/assistant.service';
import { toLang } from '../i18n';

// Public MobiCova Assistant — product/site Q&A (not health advice). No account.
export async function assistantChat(req: Request, res: Response): Promise<void> {
  const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages: AssistantMessage[] = rawMessages
    .filter((m: unknown): m is AssistantMessage =>
      !!m && typeof (m as AssistantMessage).content === 'string' &&
      ((m as AssistantMessage).role === 'user' || (m as AssistantMessage).role === 'assistant'))
    .map((m: AssistantMessage) => ({ role: m.role, content: String(m.content).slice(0, 2000) }))
    .slice(-10);

  if (messages.length === 0) {
    res.status(400).json({ error: 'Ask a question to get started.' });
    return;
  }

  const lang = toLang(req.body?.lang);
  const answer = await answerAssistant(messages, lang);
  res.json(answer);
}
