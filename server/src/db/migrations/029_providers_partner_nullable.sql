-- Unified org model — Phase 4.
-- A clinician can now belong to an organisation with no legacy `partner`
-- (e.g. a clinic/pharmacy created directly in the Admin Console). Routing &
-- membership are driven by provider_organisations, so partner_id is optional.
ALTER TABLE providers ALTER COLUMN partner_id DROP NOT NULL;
