// AI-drafted health tips. Claude writes a STRUCTURED draft of a daily health tip
// which an admin then reviews and publishes — nothing generated here is ever sent
// to subscribers automatically. Content is general public-health guidance grounded
// in mainstream consensus (WHO / Nigeria CDC), never diagnosis, dosages or PHI.

import { anthropic, anthropicEnabled } from '../config/anthropic';
import { env } from '../config/env';

const DRAFT_MODEL = process.env.ANTHROPIC_TIPS_MODEL || env.anthropicModel;

export interface HealthTipDraft {
  title: string;
  sms_text: string;
  body: string;
  why_it_matters: string;
  action: string;
  myth: string;
  fact: string;
  source: string;
  category: string;
}

export class HealthTipDraftUnavailable extends Error {}

const SYSTEM_PROMPT = `You write daily health tips for MobiCova, a Nigerian digital health platform. Members receive one tip a day by SMS, WhatsApp and email. Your job is to draft ONE structured tip that a human admin will review before it is ever sent.

Hard rules:
- Only mainstream, well-established public-health guidance (the kind WHO or the Nigeria Centre for Disease Control would endorse). No fringe, unproven or "miracle" claims.
- General guidance for a broad audience — NEVER a diagnosis, personalised medical advice, or specific drug names/dosages.
- Write for a Nigerian audience: plain English, everyday examples, local foods and realities where natural. Warm and encouraging, never alarming or preachy.
- Do NOT invent statistics or fake citations. For "source", name a general credible body only (e.g. "WHO", "Nigeria CDC") or leave it empty. Never fabricate a URL or a specific study.
- If you cannot write something both genuinely useful and safe on the requested topic, choose a closely related safe angle instead.

Return ONLY a JSON object (no markdown, no commentary) with exactly these string fields:
{
  "title": "short headline, max ~50 characters",
  "sms_text": "the whole tip in ONE lean sentence for SMS, max ~150 characters, no title repeated",
  "body": "2-4 sentence main explanation",
  "why_it_matters": "1-2 sentences on why this matters for the reader's health",
  "action": "one concrete thing the reader can do today, starting with a verb",
  "myth": "a common misconception, OR empty string if none fits naturally",
  "fact": "the correction to that myth, OR empty string if myth is empty",
  "category": "one lowercase word: general, nutrition, fitness, prevention, hygiene, wellbeing, safety, maternal, or mental",
  "source": "a general credible body like WHO or Nigeria CDC, or empty string"
}`;

function clip(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

// Draft a single structured tip. `topic` is an optional steer ("malaria", "diabetes
// diet", …); empty means Claude picks a useful everyday topic. Throws
// HealthTipDraftUnavailable when AI isn't configured or returns nothing usable.
export async function generateHealthTipDraft(topic?: string): Promise<HealthTipDraft> {
  if (!anthropicEnabled || !anthropic) {
    throw new HealthTipDraftUnavailable('AI is not enabled for this deployment.');
  }

  const ask = topic && topic.trim()
    ? `Draft a health tip about: ${topic.trim()}.`
    : 'Draft a useful everyday health tip. Pick a topic that is broadly relevant to Nigerian adults and families.';

  const response = await anthropic.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 700,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `${ask}\n\nReturn only the JSON object.` }],
  });

  const raw = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
  // Be forgiving: pull the first {...} block in case the model wraps it.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new HealthTipDraftUnavailable('The AI did not return a usable draft. Please try again.');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new HealthTipDraftUnavailable('The AI draft could not be read. Please try again.');
  }

  const draft: HealthTipDraft = {
    title: clip(parsed.title, 160),
    sms_text: clip(parsed.sms_text, 300),
    body: clip(parsed.body, 1200),
    why_it_matters: clip(parsed.why_it_matters, 1200),
    action: clip(parsed.action, 600),
    myth: clip(parsed.myth, 600),
    fact: clip(parsed.fact, 600),
    category: clip(parsed.category, 60).toLowerCase() || 'general',
    source: clip(parsed.source, 200),
  };
  // A myth without its correction (or vice-versa) reads badly — drop the orphan.
  if (!draft.myth || !draft.fact) { draft.myth = ''; draft.fact = ''; }
  if (!draft.title || !draft.body) {
    throw new HealthTipDraftUnavailable('The AI draft was incomplete. Please try again.');
  }
  return draft;
}
