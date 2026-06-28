import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { sendEmail } from '../lib/email';
import { analyzeFeedback, getFeedbackInsights, FeedbackAnalysisUnavailable } from '../lib/feedbackInsights';

// Public "Help shape MobiCova" capture: a prospect tells us which features they
// want and their order of priority. Unauthenticated; contact details only, no PHI.

const MAX_FEATURES = 40;
const MAX_PRIORITIES = 5;

function cleanList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).slice(0, 80)).filter(Boolean).slice(0, max);
}

const pretty = (k: string) => k.replace(/_/g, ' ');

// Best-effort email notification to a configured inbox when a form is submitted.
// Never throws — a mail failure must not break the submission.
async function notifyFeedback(d: {
  name: string; email: string; organisation: string; role: string; country: string;
  wanted: string[]; priorities: string[]; useCase: string; pilot: boolean;
}): Promise<void> {
  if (!env.feedbackNotifyEmail) return;
  try {
    const row = (label: string, val: string) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#5e6e6e">${label}</td><td style="padding:4px 0"><strong>${val || '—'}</strong></td></tr>`;
    const html = `
      <h2 style="color:#0a7b7b;margin:0 0 12px">New "Shape MobiCova" submission</h2>
      <table style="border-collapse:collapse;font:14px Arial,sans-serif">
        ${row('Name', d.name)}${row('Email', d.email)}${row('Organisation', d.organisation)}
        ${row('Role', d.role)}${row('Country', d.country)}
        ${row('Priorities', d.priorities.map(pretty).join(' → '))}
        ${row('Wanted', d.wanted.map(pretty).join(', '))}
        ${row('Pilot interest', d.pilot ? 'Yes' : 'No')}
      </table>
      ${d.useCase ? `<p style="font:14px Arial,sans-serif"><em>"${d.useCase}"</em></p>` : ''}
      <p style="color:#5e6e6e;font:12px Arial,sans-serif">View all in Admin Console → Prospect feedback.</p>`;
    const text = `New Shape MobiCova submission
Name: ${d.name}
Email: ${d.email}
Organisation: ${d.organisation}
Role: ${d.role}  Country: ${d.country}
Priorities: ${d.priorities.map(pretty).join(' > ')}
Wanted: ${d.wanted.map(pretty).join(', ')}
Pilot interest: ${d.pilot ? 'Yes' : 'No'}
${d.useCase ? `Notes: ${d.useCase}` : ''}`;
    await sendEmail({
      to: env.feedbackNotifyEmail,
      subject: `New Shape MobiCova submission — ${d.name || d.email}`,
      html,
      text,
    });
  } catch (err) {
    console.error('[feedback] notify email failed:', err);
  }
}

export async function createProspectFeedback(req: Request, res: Response): Promise<void> {
  const email = String(req.body?.email || '').trim();
  if (!/.+@.+\..+/.test(email)) {
    res.status(400).json({ error: 'Enter a valid email.' });
    return;
  }
  const name = String(req.body?.name || '').slice(0, 160);
  const organisation = String(req.body?.organisation || '').slice(0, 160);
  const role = String(req.body?.role || '').slice(0, 120);
  const country = String(req.body?.country || '').slice(0, 80);
  const wanted = cleanList(req.body?.wantedFeatures, MAX_FEATURES);
  const priorities = cleanList(req.body?.priorities, MAX_PRIORITIES);
  const useCase = String(req.body?.useCase || '').slice(0, 2000);
  const pilot = Boolean(req.body?.pilotInterest);
  const consent = Boolean(req.body?.consent);

  await query(
    `INSERT INTO prospect_feedback
       (name, email, organisation, role, country, wanted_features, priorities, use_case, pilot_interest, consent)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)`,
    [name, email.slice(0, 255), organisation, role, country,
     JSON.stringify(wanted), JSON.stringify(priorities), useCase, pilot, consent]
  );

  // Notify the team inbox (best-effort; does not block the response on failure).
  await notifyFeedback({ name, email, organisation, role, country, wanted, priorities, useCase, pilot });

  res.status(201).json({ received: true });
}

// Platform-admin view: raw submissions + two aggregates —
//  interest = how many prospects want each feature,
//  score    = priority-weighted demand (rank 1 scores highest).
export async function adminListProspectFeedback(_req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT id, name, email, organisation, role, country,
            wanted_features, priorities, use_case, pilot_interest, consent, created_at,
            ai_sentiment, ai_themes
     FROM prospect_feedback ORDER BY created_at DESC LIMIT 1000`
  );

  const interest: Record<string, number> = {};
  const score: Record<string, number> = {};
  for (const row of result.rows) {
    for (const f of (row.wanted_features || [])) interest[f] = (interest[f] || 0) + 1;
    const pr: string[] = row.priorities || [];
    pr.forEach((f, i) => { score[f] = (score[f] || 0) + (pr.length - i); });
  }

  const insights = await getFeedbackInsights();
  res.json({ submissions: result.rows, total: result.rows.length, interest, score, insights });
}

// POST /admin/prospect-feedback/analyze — run AI sentiment + theme analysis over
// the next batch of un-analysed entries. Platform-admin only (router-gated).
export async function analyzeProspectFeedback(_req: Request, res: Response): Promise<void> {
  try {
    const analyzed = await analyzeFeedback();
    const insights = await getFeedbackInsights();
    res.json({ analyzed, insights });
  } catch (err) {
    if (err instanceof FeedbackAnalysisUnavailable) {
      res.status(503).json({ error: err.message });
      return;
    }
    console.error('Feedback analysis failed:', err);
    res.status(500).json({ error: 'Could not analyse feedback. Please try again.' });
  }
}
