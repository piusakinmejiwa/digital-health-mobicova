-- 060 · Rewards Phase 3 — redemption catalogue + redemption requests
-- A platform-curated catalogue of rewards priced in points. Members redeem
-- (available balance = lifetime points − points already redeemed); each
-- redemption is a request an admin fulfils (sends airtime, applies discount,
-- issues voucher). Rejecting a request refunds the points.

CREATE TABLE IF NOT EXISTS reward_catalogue (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    kind        VARCHAR(30) NOT NULL DEFAULT 'voucher', -- airtime | premium_discount | voucher | other
    cost_points INTEGER     NOT NULL,
    value_label TEXT        NOT NULL DEFAULT '',
    stock       INTEGER,                                 -- NULL = unlimited
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_id       UUID REFERENCES organisations(id) ON DELETE SET NULL,
    catalogue_id UUID REFERENCES reward_catalogue(id) ON DELETE SET NULL,
    title        TEXT        NOT NULL DEFAULT '',   -- snapshot at redemption time
    cost_points  INTEGER     NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'requested', -- requested | approved | fulfilled | rejected
    note         TEXT        NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_redemptions_member ON reward_redemptions(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON reward_redemptions(status, created_at DESC);
