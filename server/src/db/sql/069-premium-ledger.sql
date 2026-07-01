-- =====================================================================
-- 069 · Premium ledger (settlement Phase 1) — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE distribution_partners ADD COLUMN IF NOT EXISTS platform_fee_rate NUMERIC(5,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS premium_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrolment_id        UUID REFERENCES enrolments(id),
    partner_id          UUID REFERENCES distribution_partners(id),
    org_id              UUID NOT NULL REFERENCES organisations(id),
    plan_id             UUID REFERENCES insurance_plans(id),
    type                VARCHAR(20) NOT NULL DEFAULT 'premium',
    gross_amount        NUMERIC(14,2) NOT NULL,
    commission_rate     NUMERIC(5,2)  NOT NULL DEFAULT 0,
    commission_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
    platform_fee_rate   NUMERIC(5,2)  NOT NULL DEFAULT 0,
    platform_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    levy_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_amount          NUMERIC(14,2) NOT NULL,
    currency            VARCHAR(10) DEFAULT 'NGN',
    period              CHAR(7),
    external_txn_ref    VARCHAR(160),
    status              VARCHAR(20) DEFAULT 'recorded',
    collected_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_premium_txn_partner_ref
    ON premium_transactions(partner_id, external_txn_ref)
    WHERE external_txn_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_premium_txn_partner_period ON premium_transactions(partner_id, period);
CREATE INDEX IF NOT EXISTS idx_premium_txn_enrolment ON premium_transactions(enrolment_id);

INSERT INTO _migrations (name) VALUES ('069_premium_ledger.sql')
ON CONFLICT (name) DO NOTHING;
