// AI care summaries — Claude writes a concise, factual clinical hand-off note
// for a member, grounded ONLY in the structured data we already hold (conditions,
// allergies, medications, recent triage, recent consultations). No diagnosis, no
// treatment advice, no invented history. Each summary is stored for audit + count.

import { query } from '../config/database';
import { anthropic, anthropicEnabled } from '../config/anthropic';
import { env } from '../config/env';

const SUMMARY_MODEL = process.env.ANTHROPIC_SUMMARY_MODEL || env.anthropicModel;

export interface CareSummary {
  summary: string;
  model: string;
  created_at: string;
}

export class CareSummaryUnavailable extends Error {}

const SYSTEM_PROMPT = `You are a clinical documentation assistant for MobiCova, a Nigerian digital health platform. Write a concise care summary of a member for a clinician who is about to see them.

Rules:
- Use ONLY the structured data provided. Never invent conditions, medications, allergies, dates or history.
- 3–5 sentences, neutral and professional, at most ~120 words. No headings, no bullet lists.
- Lead with active chronic conditions, then allergies and current medications, then the most recent triage urgency and any recent consultations.
- Do NOT give a diagnosis, treatment plan, or medical advice. This is a factual hand-off note, not clinical judgement.
- If the record is sparse, say so briefly rather than padding.`;

async function buildContext(orgId: string, memberId: string): Promise<string | null> {
  const m = await query(
    `SELECT full_name, gender, date_of_birth, blood_group,
            allergies, chronic_conditions, current_medications, created_at
       FROM members WHERE id = $1 AND org_id = $2`,
    [memberId, orgId],
  );
  if (m.rows.length === 0) return null;
  const member = m.rows[0];

  const triage = await query(
    `SELECT triage_level, recommendation, created_at
       FROM triage_sessions WHERE member_id = $1
      ORDER BY created_at DESC LIMIT 5`,
    [memberId],
  );
  const consults = await query(
    `SELECT mode, status, reason, diagnosis, created_at
       FROM consultations WHERE member_id = $1
      ORDER BY created_at DESC LIMIT 5`,
    [memberId],
  );

  const arr = (v: unknown): string => (Array.isArray(v) && v.length ? v.join(', ') : 'none recorded');
  const lines: string[] = [
    `Name: ${member.full_name}`,
    `Gender: ${member.gender || 'not recorded'}`,
    `Date of birth: ${member.date_of_birth || 'not recorded'}`,
    `Blood group: ${member.blood_group || 'not recorded'}`,
    `Chronic conditions: ${arr(member.chronic_conditions)}`,
    `Allergies: ${arr(member.allergies)}`,
    `Current medications: ${arr(member.current_medications)}`,
  ];

  if (triage.rows.length) {
    lines.push('Recent AI triage:');
    for (const t of triage.rows) {
      lines.push(`  - ${String(t.created_at).slice(0, 10)} · urgency: ${t.triage_level}${t.recommendation ? ` · ${t.recommendation}` : ''}`);
    }
  } else {
    lines.push('Recent AI triage: none');
  }

  if (consults.rows.length) {
    lines.push('Recent consultations:');
    for (const c of consults.rows) {
      const detail = [c.reason, c.diagnosis].filter(Boolean).join(' → ');
      lines.push(`  - ${String(c.created_at).slice(0, 10)} · ${c.mode} · ${c.status}${detail ? ` · ${detail}` : ''}`);
    }
  } else {
    lines.push('Recent consultations: none');
  }

  return lines.join('\n');
}

// Generate a fresh summary, persist it, and return it. Throws CareSummaryUnavailable
// when AI isn't configured or the member can't be found.
export async function generateCareSummary(orgId: string, memberId: string, userId: string): Promise<CareSummary> {
  if (!anthropicEnabled || !anthropic) {
    throw new CareSummaryUnavailable('AI is not enabled for this deployment.');
  }
  const context = await buildContext(orgId, memberId);
  if (context === null) {
    throw new CareSummaryUnavailable('Member not found.');
  }

  const response = await anthropic.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Member record:\n\n${context}\n\nWrite the care summary.` }],
  });
  const summary = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
  if (!summary) throw new CareSummaryUnavailable('The AI did not return a summary. Please try again.');

  const inserted = await query(
    `INSERT INTO member_care_summaries (org_id, member_id, summary, model, generated_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING summary, model, created_at`,
    [orgId, memberId, summary, SUMMARY_MODEL, userId],
  );
  return inserted.rows[0];
}

// Latest stored summary for a member, or null if none yet.
export async function getLatestCareSummary(orgId: string, memberId: string): Promise<CareSummary | null> {
  const r = await query(
    `SELECT summary, model, created_at
       FROM member_care_summaries
      WHERE member_id = $1 AND org_id = $2
      ORDER BY created_at DESC LIMIT 1`,
    [memberId, orgId],
  );
  return r.rows[0] || null;
}
