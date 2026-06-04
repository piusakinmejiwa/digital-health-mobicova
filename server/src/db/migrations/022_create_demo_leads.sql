-- Phase 4: public marketing site — "Book a demo" lead capture. Unauthenticated
-- visitors submit interest; the sales team follows up. (No PHI; contact details only.)
CREATE TABLE IF NOT EXISTS demo_leads (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email        VARCHAR(255) NOT NULL,
    company      VARCHAR(160) NOT NULL DEFAULT '',
    partner_type VARCHAR(60)  NOT NULL DEFAULT '',
    member_band  VARCHAR(40)  NOT NULL DEFAULT '',
    source       VARCHAR(60)  NOT NULL DEFAULT 'marketing',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
