-- =====================================================================
-- 067 · Password-reset tokens (staff users + providers) — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE users     ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE users     ADD COLUMN IF NOT EXISTS reset_expires    TIMESTAMPTZ;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS reset_expires    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_reset     ON users(reset_token_hash);
CREATE INDEX IF NOT EXISTS idx_providers_reset ON providers(reset_token_hash);

INSERT INTO _migrations (name) VALUES ('067_password_reset.sql')
ON CONFLICT (name) DO NOTHING;
