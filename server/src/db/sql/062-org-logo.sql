-- =====================================================================
-- 062 · Organisation logo image — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE org_branding ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';

INSERT INTO _migrations (name) VALUES ('062_org_logo.sql')
ON CONFLICT (name) DO NOTHING;
