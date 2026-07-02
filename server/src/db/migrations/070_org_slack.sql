-- Per-tenant Slack notifications. An org connects one Slack Incoming Webhook and
-- MobiCova posts a PHI-SAFE headline + deep link for the notification categories
-- they enable (the same categories that drive the in-app bell + email). The
-- webhook URL is a secret; only a masked hint is ever returned to the client.

CREATE TABLE IF NOT EXISTS org_slack (
    org_id       UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
    webhook_url  TEXT NOT NULL DEFAULT '',
    active       BOOLEAN NOT NULL DEFAULT true,   -- master on/off (pause without disconnecting)
    categories   TEXT[] NOT NULL DEFAULT '{}',    -- enabled NotificationCategory keys ({} = none)
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
