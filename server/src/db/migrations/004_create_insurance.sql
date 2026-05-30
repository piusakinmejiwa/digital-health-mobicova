-- Health-linked insurance plans distributed (not underwritten) by MobiCova.
-- Every plan is underwritten by a NAICOM-licensed insurer partner.
CREATE TABLE insurance_plans (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255) NOT NULL,
    plan_type        VARCHAR(50) NOT NULL,
    underwriter      VARCHAR(255) NOT NULL,
    monthly_premium  NUMERIC(12,2) NOT NULL,
    currency         VARCHAR(10) DEFAULT 'NGN',
    cover_amount     NUMERIC(14,2) DEFAULT 0,
    benefits         TEXT[] DEFAULT '{}',
    description      TEXT DEFAULT '',
    commission_rate  NUMERIC(5,2) DEFAULT 15.0,
    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- A member's enrolment in an insurance plan.
CREATE TABLE enrolments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    member_id          UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    plan_id            UUID NOT NULL REFERENCES insurance_plans(id),
    status             VARCHAR(30) DEFAULT 'pending',
    payment_status     VARCHAR(30) DEFAULT 'unpaid',
    stripe_session_id  VARCHAR(255),
    enrolled_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrolments_org ON enrolments(org_id);
CREATE INDEX idx_enrolments_member ON enrolments(member_id);
