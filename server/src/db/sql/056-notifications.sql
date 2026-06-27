-- =====================================================================
-- 056 · Notifications Centre — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    category    VARCHAR(40) NOT NULL,
    severity    VARCHAR(10) NOT NULL DEFAULT 'info',
    title       TEXT        NOT NULL,
    body        TEXT        NOT NULL DEFAULT '',
    href        TEXT        NOT NULL DEFAULT '',
    dedupe_key  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(org_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_dedupe
    ON notifications(org_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS notification_reads (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, notification_id)
);

CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    muted      TEXT[] NOT NULL DEFAULT '{}',
    email      TEXT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO _migrations (name) VALUES ('056_notifications.sql')
ON CONFLICT (name) DO NOTHING;
