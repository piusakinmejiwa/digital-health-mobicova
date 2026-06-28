-- =====================================================================
-- 061 · Rewards Phase 4 — per-org challenges & catalogue — paste edition
-- Run once in the Supabase SQL Editor. org_id NULL = MobiCova global default.
-- =====================================================================

ALTER TABLE reward_challenges ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE reward_catalogue  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_reward_challenges_org ON reward_challenges(org_id);
CREATE INDEX IF NOT EXISTS idx_reward_catalogue_org ON reward_catalogue(org_id);

INSERT INTO _migrations (name) VALUES ('061_rewards_per_org.sql')
ON CONFLICT (name) DO NOTHING;
