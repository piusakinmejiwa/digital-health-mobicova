-- ───────────────────────────────────────────────────────────────────────────
-- Page hero images — run-in-Supabase-SQL-Editor edition (migration 041)
-- ───────────────────────────────────────────────────────────────────────────
-- Stores admin-managed hero images for the public content pages. Idempotent.

CREATE TABLE IF NOT EXISTS page_assets (
    slug       VARCHAR(80) PRIMARY KEY,
    image_url  TEXT        NOT NULL DEFAULT '',
    prompt     TEXT        NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO _migrations (name) VALUES ('041_page_assets.sql') ON CONFLICT (name) DO NOTHING;

SELECT count(*) AS page_assets_ready FROM information_schema.tables WHERE table_name = 'page_assets';
