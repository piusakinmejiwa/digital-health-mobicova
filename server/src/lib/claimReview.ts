// AI claims-integrity review. Claude assesses ONE claim for anomalies that
// warrant a human reviewer's attention — it never approves, rejects, or pays.
// The model is given real comparative signals (the member's history, the org's
// typical amount for the claim type, possible duplicates) so its reasons cite
// facts, not guesses. Output is a conservative verdict stored on the claim.

import { query } from '../config/database';
import { anthropic, anthropicEnabled } from '../config/anthropic';
import { env } from '../config/env';

const REVIEW_MODEL = process.env.ANTHROPIC_CLAIMS_MODEL || env.anthropicModel;

export type AiVerdict = 'ok' | 'flagged';
export type AiRisk = 'low' | 'medium' | 'high';

export interface ClaimAiReview {
  ai_status: AiVerdict;
  ai_risk: AiRisk;
  ai_reasons: string[];
  ai_rationale: string;
  ai_model: string;
  ai_reviewed_at: string;
}

export class ClaimReviewUnavailable extends Error {}

const SYSTEM_PROMPT = `You are a claims-integrity assistant for MobiCova, a Nigerian health insurance platform. Assess a SINGLE claim for anomalies that warrant review by a human adjudicator.

You do NOT approve, reject, pay, or adjudicate — you only decide whether a human should take a closer look.

Consider: amount unusually high versus the typical amount for this claim type and versus the member's own history; possible duplicate of an existing claim; mismatch between claim type, description and provider; unusually high claim frequency for the member; vague or missing description.

Return STRICT JSON only, no prose around it:
{"verdict":"ok"|"flagged","risk":"low"|"medium"|"high","reasons":["short reason", ...],"rationale":"one or two sentences"}

Rules:
- Base everything ONLY on the data provided. Never invent facts or amounts.
- Be conservative: flag only genuine concerns. If nothing stands out, return verdict "ok", risk "low", reasons [].
- Keep each reason under ~12 words. Maximum 4 reasons.`;

interface Ctx {
  member_id: string;
  amount: number;
  claim_type: string;
  provider_name: string;
  description: string;
  service_date: string | null;
  currency: string;
}

function naira(n: number, currency: string): string {
  return `${currency} ${Number(n).toLocaleString()}`;
}

async function buildContext(orgId: string, claimId: string): Promise<{ prompt: string } | null> {
  const c = await query(
    `SELECT member_id, amount::float8 AS amount, claim_type, provider_name,
            description, service_date, currency
       FROM claims WHERE id = $1 AND org_id = $2`,
    [claimId, orgId],
  );
  if (c.rows.length === 0) return null;
  const claim: Ctx = c.rows[0];

  const mem = await query(
    `SELECT COUNT(*)::int AS prior_count,
            COALESCE(AVG(amount), 0)::float8 AS avg_amount,
            COALESCE(MAX(amount), 0)::float8 AS max_amount,
            COUNT(*) FILTER (WHERE created_at >= NOW() - interval '30 days')::int AS last30
       FROM claims
      WHERE org_id = $1 AND member_id = $2 AND id <> $3`,
    [orgId, claim.member_id, claimId],
  );
  const typ = await query(
    `SELECT COUNT(*)::int AS type_count, COALESCE(AVG(amount), 0)::float8 AS type_avg
       FROM claims
      WHERE org_id = $1 AND claim_type = $2 AND id <> $3`,
    [orgId, claim.claim_type, claimId],
  );
  const dup = await query(
    `SELECT COUNT(*)::int AS dup
       FROM claims
      WHERE org_id = $1 AND member_id = $2 AND id <> $3
        AND provider_name = $4 AND amount = $5
        AND (service_date IS NOT DISTINCT FROM $6 OR created_at >= NOW() - interval '14 days')`,
    [orgId, claim.member_id, claimId, claim.provider_name, claim.amount, claim.service_date],
  );

  const m = mem.rows[0];
  const t = typ.rows[0];
  const lines = [
    `Claim under review:`,
    `- Type: ${claim.claim_type}`,
    `- Amount: ${naira(claim.amount, claim.currency)}`,
    `- Provider: ${claim.provider_name || '(none given)'}`,
    `- Service date: ${claim.service_date || '(none given)'}`,
    `- Description: ${claim.description ? claim.description : '(none given)'}`,
    ``,
    `Member history (this org, excluding this claim):`,
    `- Prior claims: ${m.prior_count}`,
    `- Member average claim amount: ${naira(Math.round(m.avg_amount), claim.currency)}`,
    `- Member highest prior claim: ${naira(Math.round(m.max_amount), claim.currency)}`,
    `- Claims in the last 30 days: ${m.last30}`,
    ``,
    `Organisation baseline for "${claim.claim_type}" claims:`,
    `- Count: ${t.type_count}`,
    `- Average amount: ${naira(Math.round(t.type_avg), claim.currency)}`,
    ``,
    `Possible duplicates (same member, provider and amount): ${dup.rows[0].dup}`,
  ];
  return { prompt: lines.join('\n') };
}

function parseVerdict(text: string): { verdict: AiVerdict; risk: AiRisk; reasons: string[]; rationale: string } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const o = JSON.parse(match[0]);
    const verdict: AiVerdict = o.verdict === 'flagged' ? 'flagged' : 'ok';
    const risk: AiRisk = ['low', 'medium', 'high'].includes(o.risk) ? o.risk : (verdict === 'flagged' ? 'medium' : 'low');
    const reasons = Array.isArray(o.reasons) ? o.reasons.map((r: unknown) => String(r)).slice(0, 4) : [];
    const rationale = typeof o.rationale === 'string' ? o.rationale : '';
    return { verdict, risk, reasons, rationale };
  } catch {
    return null;
  }
}

// Review a claim and persist the verdict. Throws ClaimReviewUnavailable when AI
// isn't configured or the claim can't be found.
export async function reviewClaim(orgId: string, claimId: string): Promise<ClaimAiReview> {
  if (!anthropicEnabled || !anthropic) {
    throw new ClaimReviewUnavailable('AI is not enabled for this deployment.');
  }
  const ctx = await buildContext(orgId, claimId);
  if (!ctx) throw new ClaimReviewUnavailable('Claim not found.');

  const response = await anthropic.messages.create({
    model: REVIEW_MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `${ctx.prompt}\n\nAssess this claim.` }],
  });
  const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
  const parsed = parseVerdict(text);
  if (!parsed) throw new ClaimReviewUnavailable('The AI did not return a usable verdict. Please try again.');

  const updated = await query(
    `UPDATE claims
        SET ai_status = $1, ai_risk = $2, ai_reasons = $3::jsonb,
            ai_rationale = $4, ai_model = $5, ai_reviewed_at = NOW()
      WHERE id = $6 AND org_id = $7
      RETURNING ai_status, ai_risk, ai_reasons, ai_rationale, ai_model, ai_reviewed_at`,
    [parsed.verdict, parsed.risk, JSON.stringify(parsed.reasons), parsed.rationale, REVIEW_MODEL, claimId, orgId],
  );
  return updated.rows[0];
}

// Best-effort background review (e.g. on claim creation). Never throws.
export function reviewClaimSafe(orgId: string, claimId: string): void {
  if (!anthropicEnabled) return;
  reviewClaim(orgId, claimId).catch((err) => {
    console.error('Background claim AI review failed:', err?.message || err);
  });
}
