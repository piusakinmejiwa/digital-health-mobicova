-- Gamification / Rewards — Phase 0 (points engine) + Phase 1 (streaks, badges).
-- Rewards member actions that already happen (consult, triage, adherence, daily
-- check-in) to drive engagement. No PHI lives here — only action types + points.

-- Immutable points ledger: one row per awarded action. dedupe_key makes every
-- award idempotent, so an action can never be credited twice (anti-gaming).
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

-- Denormalised running totals + streak counters per member, for fast reads.
CREATE TABLE IF NOT EXISTS member_points (
    member_id          UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    org_id             UUID REFERENCES organisations(id) ON DELETE SET NULL,
    total_points       INTEGER NOT NULL DEFAULT 0,
    current_streak     INTEGER NOT NULL DEFAULT 0,
    longest_streak     INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Badge grants. Definitions live in code (lib/rewards); this records who earned
-- what and when. One grant per (member, badge).
CREATE TABLE IF NOT EXISTS member_badges (
    member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    badge_slug VARCHAR(40) NOT NULL,
    earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, badge_slug)
);
