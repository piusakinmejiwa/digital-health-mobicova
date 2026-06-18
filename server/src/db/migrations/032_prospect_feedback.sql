-- Public "Help shape MobiCova" prospect discovery + feature-priority capture.
-- Unauthenticated submissions from the marketing site; contact details only, no PHI.
-- wanted_features = feature keys the prospect is interested in; priorities = their
-- ordered top picks (most-wanted first).
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
