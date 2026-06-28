-- =====================================================================
-- 064 · AI claims-integrity review — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_status      VARCHAR(20) NOT NULL DEFAULT 'unreviewed';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_risk        VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_reasons     JSONB       NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_rationale   TEXT        NOT NULL DEFAULT '';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_model       VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_claims_ai_status ON claims(org_id, ai_status);

INSERT INTO _migrations (name) VALUES ('064_claim_ai_review.sql')
ON CONFLICT (name) DO NOTHING;
