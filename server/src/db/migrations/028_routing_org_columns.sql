-- Unified organisation model — Phase 0.
-- Route care by ORGANISATION rather than by legacy `partner`. Additive columns;
-- existing partner-based columns stay until reads are switched (Phase 2) and are
-- dropped later (Phase 5). Backfilled in Phase 1.

-- The clinic org that owns a consultation (derived from the doctor's org).
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS provider_org_id UUID REFERENCES organisations(id);
CREATE INDEX IF NOT EXISTS idx_consultations_provider_org ON consultations(provider_org_id);

-- The pharmacy org a prescription is routed to (replaces pharmacy_partner_id).
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pharmacy_org_id UUID REFERENCES organisations(id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy_org ON prescriptions(pharmacy_org_id);

-- The underwriter org that backs an insurance plan (replaces the free-text
-- `underwriter` string; dedupes partner-vs-org duplication for insurers).
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS underwriter_org_id UUID REFERENCES organisations(id);
CREATE INDEX IF NOT EXISTS idx_plans_underwriter_org ON insurance_plans(underwriter_org_id);
