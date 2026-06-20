-- ───────────────────────────────────────────────────────────────────────────
-- Newsletter sign-ups — run-in-Supabase-SQL-Editor edition (migration 042)
-- ───────────────────────────────────────────────────────────────────────────
-- Stores home-page newsletter subscribers. Idempotent.

CREATE TABLE IF NOT EXISTS newsletter_signups (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(160) NOT NULL DEFAULT '',
    email      VARCHAR(255) NOT NULL UNIQUE,
    phone      VARCHAR(40)  NOT NULL DEFAULT '',
    consent    BOOLEAN      NOT NULL DEFAULT false,
    source     VARCHAR(40)  NOT NULL DEFAULT 'home',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO _migrations (name) VALUES ('042_newsletter_signups.sql') ON CONFLICT (name) DO NOTHING;

SELECT count(*) AS newsletter_table_ready FROM information_schema.tables WHERE table_name = 'newsletter_signups';
