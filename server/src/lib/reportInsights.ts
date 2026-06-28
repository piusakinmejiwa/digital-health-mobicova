// AI executive insight for a scheduled report. Given the period snapshot (all
// real, org-scoped numbers — totals, deltas vs the previous period, utilisation,
// claims/premium), Claude writes a short, factual takeaway box. Grounded only in
// the numbers provided: no invented figures, no hard forecasts, no medical advice.
//
// Resilient by design: returns null if AI is off or anything fails, so a report
// always renders (just without the insight box).

import { anthropic, anthropicEnabled } from '../config/anthropic';
import { env } from '../config/env';
import type { ReportSnapshot } from './reports';

const INSIGHT_MODEL = process.env.ANTHROPIC_REPORT_MODEL || env.anthropicModel;

export interface ReportInsight {
  headline: string;
  bullets: string[];
}

const SYSTEM_PROMPT = `You write the executive "insight" box for a MobiCova health-plan report emailed to a Nigerian B2B client (an employer or insurer). You are given the period's metrics as JSON.

Output STRICT JSON only: {"headline": string, "bullets": string[]}
- headline: one sentence — the single biggest takeaway for this period.
- bullets: 2 to 4 items, each under 18 words, covering utilisation, notable movements versus the previous period (use the delta figures), and at most one thing to watch.

Rules:
- Use ONLY the numbers provided. Never invent or estimate figures not present.
- No medical advice or clinical claims.
- Avoid hard predictions; if you mention a trend, frame it as "if the current trend continues".
- Be concrete and reference the real numbers. If the period is very quiet, say so plainly.`;

function compact(snap: ReportSnapshot): Record<string, unknown> {
  // Only the decision-relevant numbers — keeps the prompt tight and on-facts.
  return {
    cadence: snap.cadence,
    period: snap.periodLabel,
    totals: snap.totals,
    thisPeriod: snap.window,
    changeVsPreviousPeriod: snap.deltas,
    utilisation: snap.utilization,
    topPlans: snap.topPlans,
    executive: snap.executive,
  };
}

function parse(text: string): ReportInsight | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const o = JSON.parse(match[0]);
    const headline = typeof o.headline === 'string' ? o.headline.trim() : '';
    const bullets = Array.isArray(o.bullets)
      ? o.bullets.map((b: unknown) => String(b).trim()).filter(Boolean).slice(0, 4)
      : [];
    if (!headline && bullets.length === 0) return null;
    return { headline, bullets };
  } catch {
    return null;
  }
}

export async function generateReportInsight(snap: ReportSnapshot): Promise<ReportInsight | null> {
  if (!anthropicEnabled || !anthropic) return null;
  try {
    const response = await anthropic.messages.create({
      model: INSIGHT_MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Report metrics:\n\n${JSON.stringify(compact(snap), null, 2)}\n\nWrite the insight box.` }],
    });
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    return parse(text);
  } catch (err) {
    console.error('Report AI insight failed (rendering without it):', (err as Error)?.message || err);
    return null;
  }
}
