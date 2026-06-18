-- ───────────────────────────────────────────────────────────────────────────
-- Prospect feedback (/shape page) — run-in-Supabase-SQL-Editor edition (migration 032)
-- ───────────────────────────────────────────────────────────────────────────
-- Apply this if the /shape form returns a 500 (the prospect_feedback table is missing).
-- Idempotent and safe to re-run. Paste the whole block into Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS prospect_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(160) NOT NULL DEFAULT '',
    email           VARCHAR(255) NOT NULL,
    organisation    VARCHAR(160) NOT NULL DEFAULT '',
    role            VARCHAR(120) NOT NULL DEFAULT '',
    country         VARCHAR(80)  NOT NULL DEFAULT '',
    wanted_features JSONB        NOT NULL DEFAULT '[]'::jsonb,
    priorities      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    use_case        TEXT         NOT NULL DEFAULT '',
    pilot_interest  BOOLEAN      NOT NULL DEFAULT false,
    consent         BOOLEAN      NOT NULL DEFAULT false,
    source          VARCHAR(60)  NOT NULL DEFAULT 'shape',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prospect_feedback_created ON prospect_feedback(created_at DESC);

-- Mark migration 032 as applied so `npm run migrate` won't re-run it.
INSERT INTO _migrations (name) VALUES ('032_prospect_feedback.sql') ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT count(*) AS columns_present
FROM information_schema.columns WHERE table_name = 'prospect_feedback';
