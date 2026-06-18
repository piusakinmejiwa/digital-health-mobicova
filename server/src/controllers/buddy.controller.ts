import { Request, Response } from 'express';
import { query } from '../config/database';
import { answerBuddy, BuddyMessage } from '../services/buddy.service';
import { isSpecialty } from '../lib/buddyCatalog';

const DAILY_LIMIT = Number(process.env.BUDDY_DAILY_LIMIT || 20);
const MAX_HISTORY = 12;

function cleanSessionKey(v: unknown, fallback: string): string {
  const s = String(v || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  return s || fallback.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 80) || 'anon';
}

export async function buddyChat(req: Request, res: Response): Promise<void> {
  const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages: BuddyMessage[] = rawMessages
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }))
    .slice(-MAX_HISTORY);

  const latest = [...messages].reverse().find((m) => m.role === 'user');
  if (!latest) {
    res.status(400).json({ error: 'Send a message to ask the buddy.' });
    return;
  }

  const sessionKey = cleanSessionKey(req.body?.sessionKey, req.ip || 'anon');
  const specialty = isSpecialty(req.body?.specialty) ? req.body.specialty : 'general';

  // Free-tier daily cap (atomic upsert), counting before answering.
  const usage = await query(
    `INSERT INTO buddy_usage (session_key, day, count) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (session_key, day) DO UPDATE SET count = buddy_usage.count + 1
     RETURNING count`,
    [sessionKey]
  );
  if (usage.rows[0].count > DAILY_LIMIT) {
    res.status(429).json({
      error: 'daily_limit',
      reply: `You've reached today's free limit of ${DAILY_LIMIT} messages. Please come back tomorrow — or talk to a MobiCova doctor for more help.`,
    });
    return;
  }

  const answer = await answerBuddy(messages, specialty);

  // Consented conversation log → safety-review queue (no account required).
  try {
    await query(
      `INSERT INTO buddy_messages (session_key, channel, role, content, safety, specialty)
       VALUES ($1,'web','user',$2,$3,$4)`,
      [sessionKey, latest.content, answer.safety, specialty]
    );
    await query(
      `INSERT INTO buddy_messages (session_key, channel, role, content, safety, sources, specialty)
       VALUES ($1,'web','assistant',$2,$3,$4::jsonb,$5)`,
      [sessionKey, answer.reply, answer.safety, JSON.stringify(answer.sources), specialty]
    );
  } catch (err) {
    console.error('Buddy log failed (non-fatal):', err);
  }

  res.json({ reply: answer.reply, sources: answer.sources, safety: answer.safety });
}
