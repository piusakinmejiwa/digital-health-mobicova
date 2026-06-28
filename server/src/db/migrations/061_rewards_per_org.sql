-- 061 · Rewards Phase 4 — per-org challenges & catalogue (hybrid)
-- A nullable org_id makes rewards hybrid: org_id IS NULL = a MobiCova global
-- default (applies to everyone); a non-null org_id = that organisation's own
-- reward, managed by its Company Admin. Members see both.

ALTER TABLE reward_challenges ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE reward_catalogue  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_reward_challenges_org ON reward_challenges(org_id);
CREATE INDEX IF NOT EXISTS idx_reward_catalogue_org ON reward_catalogue(org_id);
