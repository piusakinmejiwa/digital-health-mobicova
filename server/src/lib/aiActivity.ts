// AI activity — the single, honest source of "what AI actually did" for an org.
//
// Every metric here is derived from a REAL recorded AI action, never a guess or
// a placeholder. Today the only org-scoped AI capability is triage assessed by
// Claude (triage_sessions.engine = 'claude'); the free public Buddy is anonymous
// and platform-wide, so it is intentionally NOT attributed to a tenant here.
//
// As each new real capability ships (AI care summaries, claims anomaly review,
// feedback sentiment …) add one query + one metric below. If a capability isn't
// built yet, it does not appear — the card never claims work that didn't happen.

import { query } from '../config/database';
import { anthropicEnabled } from '../config/anthropic';

export interface AiMetric {
  key: string;
  label: string;
  value: number;
  suffix?: string;     // e.g. '%'
  hint?: string;       // tooltip — what this number means / how it was produced
}

export interface AiActivity {
  enabled: boolean;          // is an AI engine configured at all
  days: number;
  metrics: AiMetric[];
  hasActivity: boolean;      // any real AI work in the window
}

export async function getAiActivity(orgId: string, days = 7): Promise<AiActivity> {
  const window = `${Math.max(1, Math.min(365, days))} days`;

  // AI triage — symptom assessments Claude handled (vs the rules fallback).
  const triage = await query(
    `SELECT
        COUNT(*) FILTER (WHERE engine = 'claude')::int          AS ai_sessions,
        COUNT(DISTINCT member_id) FILTER (WHERE engine = 'claude')::int AS ai_members,
        COUNT(*)::int                                            AS total_sessions
       FROM triage_sessions
      WHERE org_id = $1 AND created_at >= NOW() - $2::interval`,
    [orgId, window],
  );
  const aiSessions = triage.rows[0]?.ai_sessions ?? 0;
  const aiMembers = triage.rows[0]?.ai_members ?? 0;
  const totalSessions = triage.rows[0]?.total_sessions ?? 0;
  const aiShare = totalSessions > 0 ? Math.round((aiSessions / totalSessions) * 100) : 0;

  const metrics: AiMetric[] = [
    {
      key: 'triage_sessions',
      label: 'Consults triaged by AI',
      value: aiSessions,
      hint: 'Symptom checks assessed by Claude, our triage model',
    },
    {
      key: 'triage_members',
      label: 'Members supported by AI',
      value: aiMembers,
      hint: 'Distinct members whose triage was AI-assisted',
    },
    {
      key: 'triage_share',
      label: 'Triage handled by AI',
      value: aiShare,
      suffix: '%',
      hint: `${aiSessions} of ${totalSessions} triage sessions in the period`,
    },
  ];

  return {
    enabled: anthropicEnabled,
    days,
    metrics,
    hasActivity: aiSessions > 0,
  };
}
