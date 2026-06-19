import { query } from '../config/database';
import { anthropic } from '../config/anthropic';
import {
  classify, crisisReply, emergencyReply, isDistress, distressReply,
  DISCLAIMER, SAFE_EMOTIONS_FOOTER, Safety,
} from '../lib/buddySafety';
import { personaFor } from '../lib/buddyCatalog';
import { languageDirective, toLang, type Lang } from '../i18n';

// Safe Emotions is a supportive companion, not a medical Q&A — it listens and
// validates rather than answering only from a medical corpus. It keeps the strict
// guardrails (no diagnosis / medication / methods) and routes crisis to helplines.
const SAFE_EMOTIONS_SYSTEM = `You are "Safe Emotions", a warm, gentle companion for people in Nigeria who want to share difficult feelings.
- Listen and validate feelings first. Be kind, calm and non-judgemental. Keep replies short: 2-4 sentences.
- You are NOT a therapist or doctor. Do NOT diagnose, do NOT give medication or medical advice, and do NOT promise to fix things.
- Gently encourage the person to reach out to someone they trust or a helpline, and offer to keep listening.
- NEVER provide methods of self-harm or anything that could cause harm. Never minimise or dismiss feelings.
- If the person expresses wanting to harm themselves or end their life, your reply must urge them to contact a crisis helpline or emergency services right away.`;

// Free tier runs on Haiku for cost; override from the dashboard if needed.
const BUDDY_MODEL = process.env.ANTHROPIC_BUDDY_MODEL || 'claude-haiku-4-5';

export type BuddySource = { name: string; url: string; title: string };
export type BuddyMessage = { role: 'user' | 'assistant'; content: string };
export type BuddyAnswer = { reply: string; sources: BuddySource[]; safety: Safety };

const SYSTEM = `You are "MobiCova Health Buddy", a warm, practical assistant that gives BASIC, general health information for people in Nigeria.

Grounding:
- Base your answer on the SOURCES in the user turn. If they only partly cover the question, give the helpful part plainly and confidently. Only if NOTHING in the SOURCES is relevant should you say you can't verify it and suggest visiting a clinic.
- Do NOT invent specific facts, numbers, doses or medicine names that are not in the SOURCES.
- NEVER diagnose or prescribe.

Style:
- Warm, friendly and direct — like a knowledgeable friend. Plain, simple English.
- 2–4 short sentences. Write in flowing sentences: NO headings, NO bold, NO bullet points or markdown.
- Do NOT add your own disclaimer or a "see a doctor / MobiCova can connect you" line — the app already adds that automatically. End on the practical advice itself.
- You are information only, not an emergency or crisis service.`;

// Question/filler words that shouldn't drive retrieval (so "what helps a fever"
// keys on "fever", not "help"). Kept small and health-question focused.
const STOPWORDS = new Set([
  'what', 'whats', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'should',
  'would', 'does', 'doing', 'did', 'are', 'was', 'were', 'the', 'and', 'for', 'with', 'you',
  'your', 'yours', 'this', 'that', 'these', 'those', 'about', 'any', 'some', 'get', 'got',
  'have', 'has', 'had', 'help', 'helps', 'helping', 'tip', 'tips', 'best', 'good', 'bad',
  'tell', 'know', 'need', 'want', 'please', 'thanks', 'from', 'into', 'out', 'off', 'too',
  'really', 'very', 'just', 'feel', 'feeling',
]);

// Build an OR full-text query from the meaningful words. OR (not AND) so a passage
// isn't dropped just because it lacks a filler word; ts_rank then orders by how
// well each passage matches the query terms.
function buildOrQuery(text: string): string {
  const words = (text.toLowerCase().match(/[a-z]{3,}/g) || []).filter((w) => !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 10).join(' | ');
}

// Retrieve the most relevant curated passages via Postgres full-text search.
async function retrieve(text: string, limit = 3): Promise<Array<{ title: string; body: string; source_name: string; source_url: string }>> {
  const tsq = buildOrQuery(text);
  if (!tsq) return [];
  const result = await query(
    `SELECT title, body, source_name, source_url
     FROM buddy_sources
     WHERE tsv @@ to_tsquery('english', $1)
     ORDER BY ts_rank(tsv, to_tsquery('english', $1)) DESC
     LIMIT $2`,
    [tsq, limit]
  );
  return result.rows;
}

export async function answerBuddy(messages: BuddyMessage[], specialty?: string, langInput?: unknown): Promise<BuddyAnswer> {
  const lang: Lang = toLang(langInput);
  const latest = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  // 1) Deterministic safety pre-filter — short-circuit, no model call.
  const safety = classify(latest, lang);
  if (safety === 'crisis') return { reply: crisisReply(lang), sources: [], safety };
  if (safety === 'emergency') return { reply: emergencyReply(lang), sources: [], safety };

  // Safe Emotions is a supportive companion, not corpus Q&A.
  if (specialty === 'safe_emotions') return answerSafeEmotions(messages, latest, lang);

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
    const persona = personaFor(specialty);
    const baseSystem = persona ? `${SYSTEM}\n\nPersona: ${persona}` : SYSTEM;
    const response = await anthropic.messages.create({
      model: BUDDY_MODEL,
      max_tokens: 400,
      system: `${baseSystem}${languageDirective(lang)}`,
      messages: [...history, { role: 'user', content: userTurn }],
    });
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
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

// Safe Emotions: distress (deterministic, no model call) first; otherwise a short,
// warm, guardrailed supportive reply with an always-on helpline footer. Crisis /
// emergency were already handled by the caller's pre-filter.
async function answerSafeEmotions(messages: BuddyMessage[], latest: string, lang: Lang = 'en'): Promise<BuddyAnswer> {
  if (isDistress(latest, lang)) {
    return { reply: distressReply(lang), sources: [], safety: 'distress' };
  }

  const warmFallback = "I hear you, and I'm really glad you reached out. I'm here to listen — would you like to share a little more about how you're feeling?";
  if (!anthropic) {
    return { reply: `${warmFallback}\n\n${SAFE_EMOTIONS_FOOTER}`, sources: [], safety: 'ok' };
  }

  try {
    const history = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
    const response = await anthropic.messages.create({
      model: BUDDY_MODEL,
      max_tokens: 350,
      system: `${SAFE_EMOTIONS_SYSTEM}${languageDirective(lang)}`,
      messages: [...history, { role: 'user', content: latest.slice(0, 2000) }],
    });
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    return { reply: `${text || warmFallback}\n\n${SAFE_EMOTIONS_FOOTER}`, sources: [], safety: 'ok' };
  } catch (err) {
    console.error('Safe Emotions generation failed:', err);
    return { reply: `${warmFallback}\n\n${SAFE_EMOTIONS_FOOTER}`, sources: [], safety: 'ok' };
  }
}
