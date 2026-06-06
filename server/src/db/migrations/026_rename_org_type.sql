-- Unified organisation model — Phase 0 (structural, additive).
-- Rename organisations.partner_type -> type. Every org (underwriter, company,
-- telco, clinic, pharmacy, diagnostics, ...) is now described by a single `type`.
-- Idempotent: only rename while the old column still exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'partner_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'type'
  ) THEN
    ALTER TABLE organisations RENAME COLUMN partner_type TO type;
  END IF;
END $$;

-- Provenance: which legacy `partners` row an org was migrated from (Phase 1).
-- NULL for natively-created orgs. Lets the data migration stay idempotent and
-- lets routing backfills join partner_id -> org_id reliably.
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS legacy_partner_id UUID;
CREATE INDEX IF NOT EXISTS idx_orgs_legacy_partner ON organisations(legacy_partner_id);
