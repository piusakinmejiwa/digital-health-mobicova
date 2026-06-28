-- AI claims-integrity review. The model flags a claim for HUMAN review; it never
-- approves, rejects, or pays. Current verdict lives on the claim row so the list
-- can show an indicator cheaply; reviewed_at + model give an audit trail.
--   ai_status: 'unreviewed' | 'ok' | 'flagged'
--   ai_risk:   '' | 'low' | 'medium' | 'high'

ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_status      VARCHAR(20) NOT NULL DEFAULT 'unreviewed';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_risk        VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_reasons     JSONB       NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_rationale   TEXT        NOT NULL DEFAULT '';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_model       VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_claims_ai_status ON claims(org_id, ai_status);
