-- HMO margin in the premium split (org hierarchy Phase 4 / settlement). The HMO
-- that offers a plan takes a margin (capitation / administration) out of the
-- premium, ahead of the net that reaches the underwriter. The rate lives on the
-- plan — mirroring commission_rate — and the ledger records the amount + which HMO.
-- Additive: default 0 means existing splits are unchanged. See
-- docs/ORG-HIERARCHY-DESIGN.md.

ALTER TABLE insurance_plans
  ADD COLUMN IF NOT EXISTS hmo_margin_rate NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE premium_transactions
  ADD COLUMN IF NOT EXISTS hmo_margin_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hmo_org_id UUID REFERENCES organisations(id);
