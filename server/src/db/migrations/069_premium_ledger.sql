-- Settlement Phase 1: the premium ledger. One immutable row per money event on a
-- partner-distributed policy. Splits gross premium into partner commission, the
-- (configurable) MobiCova platform fee, statutory levy, and net due to the
-- underwriter — each stored as an exact decimal with the rates snapshotted at
-- collection time. See docs/PARTNER-SETTLEMENT-DESIGN.md.

-- Configurable MobiCova fee per partner (0 until a rate is agreed).
ALTER TABLE distribution_partners ADD COLUMN IF NOT EXISTS platform_fee_rate NUMERIC(5,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS premium_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrolment_id        UUID REFERENCES enrolments(id),
    partner_id          UUID REFERENCES distribution_partners(id),
    org_id              UUID NOT NULL REFERENCES organisations(id),  -- underwriter
    plan_id             UUID REFERENCES insurance_plans(id),
    type                VARCHAR(20) NOT NULL DEFAULT 'premium',       -- premium | refund | chargeback | adjustment
    gross_amount        NUMERIC(14,2) NOT NULL,
    commission_rate     NUMERIC(5,2)  NOT NULL DEFAULT 0,  -- snapshot at collection
    commission_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,  -- partner keeps
    platform_fee_rate   NUMERIC(5,2)  NOT NULL DEFAULT 0,  -- snapshot at collection
    platform_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,  -- MobiCova keeps
    levy_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,  -- statutory (NAICOM/VAT) line
    net_amount          NUMERIC(14,2) NOT NULL,            -- due to the underwriter
    currency            VARCHAR(10) DEFAULT 'NGN',
    period              CHAR(7),                            -- 'YYYY-MM' billing cycle (WAT)
    external_txn_ref    VARCHAR(160),                       -- partner's transaction id (idempotency)
    status              VARCHAR(20) DEFAULT 'recorded',     -- recorded | reconciled | disputed
    collected_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- One ledger row per partner transaction (idempotent re-tries).
CREATE UNIQUE INDEX IF NOT EXISTS uq_premium_txn_partner_ref
    ON premium_transactions(partner_id, external_txn_ref)
    WHERE external_txn_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_premium_txn_partner_period ON premium_transactions(partner_id, period);
CREATE INDEX IF NOT EXISTS idx_premium_txn_enrolment ON premium_transactions(enrolment_id);
