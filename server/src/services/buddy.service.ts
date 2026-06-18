import { query } from '../config/database';
import { anthropic } from '../config/anthropic';
import { classify, crisisReply, emergencyReply, DISCLAIMER, Safety } from '../lib/buddySafety';

// Free tier runs on Haiku for cost; override from the dashboard if needed.
const BUDDY_MODEL = process.env.ANTHROPIC_BUDDY_MODEL || 'claude-haiku-4-5';

export type BuddySource = { name: string; url: string; title: string };
export type BuddyMessage = { role: 'user' | 'assistant'; content: string };
export type BuddyAnswer = { reply: string; sources: BuddySource[]; safety: Safety };

const SYSTEM = `You are "MobiCova Health Buddy", a warm, friendly assistant that gives BASIC, general health information for people in Nigeria.

Rules — follow strictly:
- Answer ONLY using the SOURCES provided in the user turn. If the sources do not cover the question, say you can't verify that and suggest seeing a clinician (MobiCova can connect them to a doctor). Do not use outside knowledge.
- NEVER diagnose, prescribe medicines, or give doses.
- Keep replies short and plain: 2–4 short sentences, simple English.
- Name the source(s) you used (e.g. "Source: WHO").
- Be kind and non-judgemental. Encourage seeing a clinician for anything beyond basic info.
- You are information only, not an emergency or crisis service.`;

// Retrieve the most relevant curated passages via Postgres full-text search.
async function retrieve(text: string, limit = 3): Promise<Array<{ title: string; body: string; source_name: string; source_url: string }>> {
  const result = await query(
    `SELECT title, body, source_name, source_url
     FROM buddy_sources
     WHERE tsv @@ websearch_to_tsquery('english', $1)
     ORDER BY ts_rank(tsv, websearch_to_tsquery('english', $1)) DESC
     LIMIT $2`,
    [text, limit]
  );
  return result.rows;
}

export async function answerBuddy(messages: BuddyMessage[]): Promise<BuddyAnswer> {
  const latest = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  // 1) Deterministic safety pre-filter — short-circuit, no model call.
  const safety = classify(latest);
  if (safety === 'crisis') return { reply: crisisReply(), sources: [], safety };
  if (safety === 'emergency') return { reply: emergencyReply(), sources: [], safety };

  // 2) Retrieve grounding passages.
  const passages = await retrieve(latest);
  const sources: BuddySource[] = passages.map((p) => ({ name: p.source_name, url: p.source_url, title: p.title }));

  // No trusted source covers it → safe decline (no hallucination).
  if (passages.length === 0) {
    return {
      reply:
        "I can only share information from trusted health sources, and I don't have a verified answer for that. " +
        'Please speak to a clinician — MobiCova can connect you to a doctor. ' +
        DISCLAIMER,
      sources: [],
      safety: 'ok',
    };
  }

  const sourcesBlock = passages
    .map((p, i) => `[${i + 1}] ${p.title} (Source: ${p.source_name})\n${p.body}`)
    .join('\n\n');

  // 3) Generate — grounded on the retrieved passages.
  if (!anthropic) {
    // Graceful degradation when no API key: return the top passage verbatim.
    const top = passages[0];
    return {
      reply: `${top.body} (Source: ${top.source_name})\n\n${DISCLAIMER}`,
      sources,
      safety: 'ok',
    };
  }

  try {
    const userTurn = `SOURCES:\n${sourcesBlock}\n\nQuestion: ${latest}`;
    const history = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
    const response = await anthropic.messages.create({
      model: BUDDY_MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: [...history, { role: 'user', content: userTurn }],
    });
    const text = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    // 4) Post-filter: always attach the disclaimer.
    const reply = text ? `${text}\n\n${DISCLAIMER}` : `${passages[0].body} (Source: ${passages[0].source_name})\n\n${DISCLAIMER}`;
    return { reply, sources, safety: 'ok' };
  } catch (err) {
    console.error('Buddy generation failed, returning grounded fallback:', err);
    const top = passages[0];
    return { reply: `${top.body} (Source: ${top.source_name})\n\n${DISCLAIMER}`, sources, safety: 'ok' };
  }
}
