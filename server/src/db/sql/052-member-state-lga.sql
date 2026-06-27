-- =====================================================================
-- 052 · Member state + LGA columns
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS state VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS lga   VARCHAR(80) NOT NULL DEFAULT '';

INSERT INTO _migrations (name) VALUES ('052_member_state_lga.sql')
ON CONFLICT (name) DO NOTHING;
