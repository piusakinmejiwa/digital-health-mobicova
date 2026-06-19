-- ───────────────────────────────────────────────────────────────────────────
-- Language preference (multilingual Phase 0) — run-in-Supabase-SQL-Editor edition (migration 036)
-- ───────────────────────────────────────────────────────────────────────────
-- Adds language columns so members/sessions can run in Pidgin (and later Hausa,
-- Yoruba, Igbo). Default 'en' = no change for anyone. Idempotent; safe to re-run.

ALTER TABLE members ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(8) NOT NULL DEFAULT 'en';
ALTER TABLE intake_sessions ADD COLUMN IF NOT EXISTS language VARCHAR(8) NOT NULL DEFAULT 'en';

-- Mark migration 036 as applied so `npm run migrate` won't re-run it.
INSERT INTO _migrations (name) VALUES ('036_language_preference.sql') ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'members' AND column_name = 'preferred_language') AS member_col,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'intake_sessions' AND column_name = 'language') AS session_col;
