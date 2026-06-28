// AI sentiment + theme analysis for prospect "Shape MobiCova" feedback. Runs on
// demand over each entry's free-text note (use_case), in one batched Claude call,
// and stores the result per row so aggregates render without re-billing.

import { query } from '../config/database';
import { anthropic, anthropicEnabled } from '../config/anthropic';
import { env } from '../config/env';

const FEEDBACK_MODEL = process.env.ANTHROPIC_FEEDBACK_MODEL || env.anthropicModel;
const BATCH = 60; // entries analysed per run; click again for the rest

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface FeedbackInsights {
  analyzed: number;                 // entries with a stored sentiment
  unanalyzed: number;               // entries with a note still awaiting analysis
  analyzedThisWeek: number;
  sentiment: { positive: number; neutral: number; negative: number };
  topThemes: { theme: string; count: number }[];
}

export class FeedbackAnalysisUnavailable extends Error {}

const SYSTEM_PROMPT = `You analyse prospect feedback for MobiCova, a Nigerian digital-health platform.

For each numbered entry, decide:
- sentiment: "positive", "neutral", or "negative" (the prospect's overall attitude in the text).
- themes: 1–3 short lowercase tags naming what it is about, e.g. "pricing", "telemedicine", "claims", "whatsapp", "onboarding", "integration", "coverage". Reuse the same wording across entries where the topic is the same.

Base everything ONLY on the text. Return STRICT JSON: an array with one object per entry, in the same order, like:
[{"i":0,"sentiment":"positive","themes":["pricing","telemedicine"]}]
No prose outside the JSON.`;

interface Row { id: string; use_case: string; }

function parseBatch(text: string): { i: number; sentiment: Sentiment; themes: string[] }[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return null;
    return arr.map((o: Record<string, unknown>) => ({
      i: Number(o.i),
      sentiment: (['positive', 'neutral', 'negative'].includes(String(o.sentiment)) ? o.sentiment : 'neutral') as Sentiment,
      themes: Array.isArray(o.themes) ? o.themes.map((t) => String(t).toLowerCase().slice(0, 40)).slice(0, 3) : [],
    }));
  } catch {
    return null;
  }
}

// Analyse the next batch of un-analysed entries (those with a note). Returns how
// many were analysed this run.
export async function analyzeFeedback(): Promise<number> {
  if (!anthropicEnabled || !anthropic) {
    throw new FeedbackAnalysisUnavailable('AI is not enabled for this deployment.');
  }
  const pendingResult = await query(
    `SELECT id, use_case FROM prospect_feedback
      WHERE ai_analyzed_at IS NULL AND length(trim(use_case)) > 0
      ORDER BY created_at DESC LIMIT $1`,
    [BATCH],
  );
  const pending = { rows: pendingResult.rows as Row[] };
  if (pending.rows.length === 0) return 0;

  const list = pending.rows.map((r, i) => `Entry ${i}: "${r.use_case.replace(/\s+/g, ' ').slice(0, 600)}"`).join('\n');
  const response = await anthropic.messages.create({
    model: FEEDBACK_MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `${list}\n\nAnalyse all ${pending.rows.length} entries.` }],
  });
  const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
  const parsed = parseBatch(text);
  if (!parsed) throw new FeedbackAnalysisUnavailable('The AI did not return usable analysis. Please try again.');

  const byIndex = new Map(parsed.map((p) => [p.i, p]));
  let analyzed = 0;
  for (let i = 0; i < pending.rows.length; i++) {
    const p = byIndex.get(i);
    if (!p) continue;
    await query(
      `UPDATE prospect_feedback
          SET ai_sentiment = $1, ai_themes = $2::jsonb, ai_model = $3, ai_analyzed_at = NOW()
        WHERE id = $4`,
      [p.sentiment, JSON.stringify(p.themes), FEEDBACK_MODEL, pending.rows[i].id],
    );
    analyzed++;
  }
  return analyzed;
}

export async function getFeedbackInsights(): Promise<FeedbackInsights> {
  const agg = await query(
    `SELECT
        COUNT(*) FILTER (WHERE ai_analyzed_at IS NOT NULL)::int AS analyzed,
        COUNT(*) FILTER (WHERE ai_analyzed_at IS NULL AND length(trim(use_case)) > 0)::int AS unanalyzed,
        COUNT(*) FILTER (WHERE ai_analyzed_at >= NOW() - interval '7 days')::int AS this_week,
        COUNT(*) FILTER (WHERE ai_sentiment = 'positive')::int AS positive,
        COUNT(*) FILTER (WHERE ai_sentiment = 'neutral')::int AS neutral,
        COUNT(*) FILTER (WHERE ai_sentiment = 'negative')::int AS negative
       FROM prospect_feedback`,
  );
  const themes = await query(
    `SELECT theme, COUNT(*)::int AS count
       FROM prospect_feedback, jsonb_array_elements_text(ai_themes) AS theme
      WHERE ai_analyzed_at IS NOT NULL
      GROUP BY theme ORDER BY count DESC, theme LIMIT 8`,
  );
  const a = agg.rows[0];
  return {
    analyzed: a.analyzed,
    unanalyzed: a.unanalyzed,
    analyzedThisWeek: a.this_week,
    sentiment: { positive: a.positive, neutral: a.neutral, negative: a.negative },
    topThemes: themes.rows,
  };
}
