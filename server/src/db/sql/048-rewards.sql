-- =====================================================================
-- 048 · Rewards / gamification engine — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS reward_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_id      UUID REFERENCES organisations(id) ON DELETE SET NULL,
    action      VARCHAR(40)  NOT NULL,
    points      INTEGER      NOT NULL DEFAULT 0,
    dedupe_key  TEXT         NOT NULL UNIQUE,
    meta        JSONB        NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reward_events_member ON reward_events(member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS member_points (
    member_id          UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    org_id             UUID REFERENCES organisations(id) ON DELETE SET NULL,
    total_points       INTEGER NOT NULL DEFAULT 0,
    current_streak     INTEGER NOT NULL DEFAULT 0,
    longest_streak     INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_badges (
    member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    badge_slug VARCHAR(40) NOT NULL,
    earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, badge_slug)
);

INSERT INTO _migrations (name) VALUES ('048_rewards.sql')
ON CONFLICT (name) DO NOTHING;
