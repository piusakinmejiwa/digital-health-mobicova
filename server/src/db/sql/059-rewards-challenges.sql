-- =====================================================================
-- 059 · Rewards Phase 2 — challenges + leaderboard opt-in — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS reward_challenges (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT        NOT NULL,
    description  TEXT        NOT NULL DEFAULT '',
    action       VARCHAR(40) NOT NULL,
    target       INTEGER     NOT NULL DEFAULT 1,
    window       VARCHAR(10) NOT NULL DEFAULT 'weekly',
    bonus_points INTEGER     NOT NULL DEFAULT 0,
    is_active    BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE member_points ADD COLUMN IF NOT EXISTS leaderboard_opt_in BOOLEAN NOT NULL DEFAULT false;

INSERT INTO _migrations (name) VALUES ('059_rewards_challenges.sql')
ON CONFLICT (name) DO NOTHING;
