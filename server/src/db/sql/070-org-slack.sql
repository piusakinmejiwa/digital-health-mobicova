-- =====================================================================
-- 070 · Per-tenant Slack notifications (org_slack) — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS org_slack (
    org_id       UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
    webhook_url  TEXT NOT NULL DEFAULT '',
    active       BOOLEAN NOT NULL DEFAULT true,
    categories   TEXT[] NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO _migrations (name) VALUES ('070_org_slack.sql')
ON CONFLICT (name) DO NOTHING;
