-- =====================================================================
-- 054 · Scheduled client reports — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS report_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    cadence     VARCHAR(10) NOT NULL,            -- daily | weekly | monthly
    recipients  TEXT[]      NOT NULL DEFAULT '{}',
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, cadence)
);
CREATE INDEX IF NOT EXISTS idx_report_subs_cadence ON report_subscriptions(cadence) WHERE is_active;

CREATE TABLE IF NOT EXISTS report_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    cadence       VARCHAR(10) NOT NULL,
    period_key    TEXT        NOT NULL,
    period_start  TIMESTAMPTZ NOT NULL,
    period_end    TIMESTAMPTZ NOT NULL,
    snapshot      JSONB       NOT NULL DEFAULT '{}',
    recipients    TEXT[]      NOT NULL DEFAULT '{}',
    sent_count    INTEGER     NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'generated',
    error         TEXT        NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, cadence, period_key)
);
CREATE INDEX IF NOT EXISTS idx_report_runs_org ON report_runs(org_id, created_at DESC);

INSERT INTO _migrations (name) VALUES ('054_scheduled_reports.sql')
ON CONFLICT (name) DO NOTHING;
