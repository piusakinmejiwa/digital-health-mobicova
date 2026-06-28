-- AI sentiment + theme tags for prospect "Shape MobiCova" feedback. Analysis is
-- run on demand over the free-text use_case; results are stored so the page can
-- show aggregates (sentiment mix, top themes) without re-billing each visit.
--   ai_sentiment: '' | 'positive' | 'neutral' | 'negative'

ALTER TABLE prospect_feedback ADD COLUMN IF NOT EXISTS ai_sentiment   VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE prospect_feedback ADD COLUMN IF NOT EXISTS ai_themes      JSONB       NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE prospect_feedback ADD COLUMN IF NOT EXISTS ai_model       VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE prospect_feedback ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;
