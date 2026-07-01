-- =====================================================================
-- 066 · Member + provider session epoch (token revocation) — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE members   ADD COLUMN IF NOT EXISTS session_epoch INT NOT NULL DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS session_epoch INT NOT NULL DEFAULT 0;

INSERT INTO _migrations (name) VALUES ('066_session_epoch.sql')
ON CONFLICT (name) DO NOTHING;
