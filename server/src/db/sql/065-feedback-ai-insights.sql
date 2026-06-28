-- =====================================================================
-- 065 · AI feedback sentiment + themes — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE prospect_feedback ADD COLUMN IF NOT EXISTS ai_sentiment   VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE prospect_feedback ADD COLUMN IF NOT EXISTS ai_themes      JSONB       NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE prospect_feedback ADD COLUMN IF NOT EXISTS ai_model       VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE prospect_feedback ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

INSERT INTO _migrations (name) VALUES ('065_feedback_ai_insights.sql')
ON CONFLICT (name) DO NOTHING;
