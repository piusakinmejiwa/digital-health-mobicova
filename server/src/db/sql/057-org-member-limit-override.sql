-- =====================================================================
-- 057 · Per-organisation member limit override — paste edition
-- Run once in the Supabase SQL Editor.
-- NULL = use the plan tier's default member limit.
-- =====================================================================

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS member_limit_override INTEGER;

INSERT INTO _migrations (name) VALUES ('057_org_member_limit_override.sql')
ON CONFLICT (name) DO NOTHING;
