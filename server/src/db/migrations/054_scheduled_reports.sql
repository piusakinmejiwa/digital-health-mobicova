-- 054 · Scheduled client reports
-- Per-tenant report subscriptions (cadence + recipients) and an idempotent run
-- ledger that doubles as the in-app report archive. One report per
-- (org, cadence, period) is ever generated/sent — the UNIQUE key guards against
-- a cron firing twice or a manual + scheduled overlap on the same period.

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
    cadence       VARCHAR(10) NOT NULL,          -- daily | weekly | monthly
    period_key    TEXT        NOT NULL,          -- e.g. 2026-06-27 | 2026-W26 | 2026-06
    period_start  TIMESTAMPTZ NOT NULL,
    period_end    TIMESTAMPTZ NOT NULL,
    snapshot      JSONB       NOT NULL DEFAULT '{}',
    recipients    TEXT[]      NOT NULL DEFAULT '{}',
    sent_count    INTEGER     NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'generated', -- generated | sent | failed
    error         TEXT        NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, cadence, period_key)
);
CREATE INDEX IF NOT EXISTS idx_report_runs_org ON report_runs(org_id, created_at DESC);
