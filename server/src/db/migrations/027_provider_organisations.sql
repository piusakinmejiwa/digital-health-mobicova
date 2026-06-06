-- Unified organisation model — Phase 0.
-- Doctors/pharmacists can belong to MORE THAN ONE organisation (a doctor may
-- work across several clinics). Model provider<->org as many-to-many.
-- The single `providers.partner_id` link is retained for now and superseded by
-- this table (backfilled in Phase 1).
CREATE TABLE IF NOT EXISTS provider_organisations (
  provider_id UUID NOT NULL REFERENCES providers(id)     ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  is_primary  BOOLEAN     NOT NULL DEFAULT false,  -- the provider's "home" org
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_orgs_org      ON provider_organisations(org_id);
CREATE INDEX IF NOT EXISTS idx_provider_orgs_provider ON provider_organisations(provider_id);
