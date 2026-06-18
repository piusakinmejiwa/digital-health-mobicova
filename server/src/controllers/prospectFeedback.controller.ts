import { Request, Response } from 'express';
import { query } from '../config/database';

// Public "Help shape MobiCova" capture: a prospect tells us which features they
// want and their order of priority. Unauthenticated; contact details only, no PHI.

const MAX_FEATURES = 40;
const MAX_PRIORITIES = 5;

function cleanList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).slice(0, 80)).filter(Boolean).slice(0, max);
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

  res.status(201).json({ received: true });
}

// Platform-admin view: raw submissions + two aggregates —
//  interest = how many prospects want each feature,
//  score    = priority-weighted demand (rank 1 scores highest).
export async function adminListProspectFeedback(_req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT id, name, email, organisation, role, country,
            wanted_features, priorities, use_case, pilot_interest, consent, created_at
     FROM prospect_feedback ORDER BY created_at DESC LIMIT 1000`
  );

  const interest: Record<string, number> = {};
  const score: Record<string, number> = {};
  for (const row of result.rows) {
    for (const f of (row.wanted_features || [])) interest[f] = (interest[f] || 0) + 1;
    const pr: string[] = row.priorities || [];
    pr.forEach((f, i) => { score[f] = (score[f] || 0) + (pr.length - i); });
  }

  res.json({ submissions: result.rows, total: result.rows.length, interest, score });
}
