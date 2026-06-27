-- 056 · Notifications Centre
-- Org-scoped event feed with PER-USER read state and preferences. A single
-- notification row is created per event (org-wide); each user tracks their own
-- read state and chooses which categories appear in-app / arrive by email.

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    category    VARCHAR(40) NOT NULL,                     -- claims | enrolments | billing | reports | members | system | security
    severity    VARCHAR(10) NOT NULL DEFAULT 'info',      -- info | warn | critical
    title       TEXT        NOT NULL,
    body        TEXT        NOT NULL DEFAULT '',
    href        TEXT        NOT NULL DEFAULT '',
    dedupe_key  TEXT,                                      -- optional; suppresses duplicate events per org
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
    muted      TEXT[] NOT NULL DEFAULT '{}',   -- categories hidden from the in-app feed
    email      TEXT[] NOT NULL DEFAULT '{}',   -- categories the user also wants emailed
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
