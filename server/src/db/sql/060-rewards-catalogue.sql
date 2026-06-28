-- =====================================================================
-- 060 · Rewards Phase 3 — catalogue + redemptions — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS reward_catalogue (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    kind        VARCHAR(30) NOT NULL DEFAULT 'voucher',
    cost_points INTEGER     NOT NULL,
    value_label TEXT        NOT NULL DEFAULT '',
    stock       INTEGER,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_id       UUID REFERENCES organisations(id) ON DELETE SET NULL,
    catalogue_id UUID REFERENCES reward_catalogue(id) ON DELETE SET NULL,
    title        TEXT        NOT NULL DEFAULT '',
    cost_points  INTEGER     NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'requested',
    note         TEXT        NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_redemptions_member ON reward_redemptions(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON reward_redemptions(status, created_at DESC);

INSERT INTO _migrations (name) VALUES ('060_rewards_catalogue.sql')
ON CONFLICT (name) DO NOTHING;
