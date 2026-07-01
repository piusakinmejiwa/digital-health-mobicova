-- =====================================================================
-- 068 · Partner Distribution API (distribution_partners + enrolment cols) — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS distribution_partners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name            VARCHAR(160) NOT NULL,
    slug            VARCHAR(80)  NOT NULL,
    key_prefix      VARCHAR(24),
    key_hash        TEXT,
    webhook_url     TEXT DEFAULT '',
    webhook_secret  TEXT DEFAULT '',
    commission_rate NUMERIC(5,2) DEFAULT 0,
    sandbox         BOOLEAN DEFAULT true,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_distribution_partners_prefix ON distribution_partners(key_prefix);
CREATE INDEX IF NOT EXISTS idx_distribution_partners_org    ON distribution_partners(org_id);

ALTER TABLE enrolments ADD COLUMN IF NOT EXISTS source_partner_id UUID REFERENCES distribution_partners(id);
ALTER TABLE enrolments ADD COLUMN IF NOT EXISTS external_ref      VARCHAR(120);
ALTER TABLE enrolments ADD COLUMN IF NOT EXISTS premium_amount    NUMERIC(12,2);
ALTER TABLE enrolments ADD COLUMN IF NOT EXISTS currency          VARCHAR(10) DEFAULT 'NGN';
ALTER TABLE enrolments ADD COLUMN IF NOT EXISTS sandbox           BOOLEAN DEFAULT false;
ALTER TABLE enrolments ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ;
ALTER TABLE enrolments ADD COLUMN IF NOT EXISTS activated_at      TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_enrolments_partner_extref
    ON enrolments(source_partner_id, external_ref)
    WHERE external_ref IS NOT NULL;

INSERT INTO _migrations (name) VALUES ('068_distribution_partners.sql')
ON CONFLICT (name) DO NOTHING;
