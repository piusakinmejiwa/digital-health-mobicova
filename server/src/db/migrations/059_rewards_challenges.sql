-- 059 · Rewards Phase 2 — admin-configurable challenges + opt-in leaderboard
-- Challenges are platform-level (one set for all members); progress is computed
-- from the existing reward_events ledger and a completion bonus is credited
-- (deduped per member per period). Leaderboard participation is per-member opt-in.

CREATE TABLE IF NOT EXISTS reward_challenges (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT        NOT NULL,
    description  TEXT        NOT NULL DEFAULT '',
    action       VARCHAR(40) NOT NULL,                 -- a RewardAction, or 'any'
    target       INTEGER     NOT NULL DEFAULT 1,
    window       VARCHAR(10) NOT NULL DEFAULT 'weekly', -- weekly | monthly | once
    bonus_points INTEGER     NOT NULL DEFAULT 0,
    is_active    BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE member_points ADD COLUMN IF NOT EXISTS leaderboard_opt_in BOOLEAN NOT NULL DEFAULT false;
