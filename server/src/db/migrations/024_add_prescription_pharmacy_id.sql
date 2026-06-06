-- Route e-prescriptions to a pharmacy by a stable partner ID (not just the name),
-- so routing survives renames and can't be broken by a typo. Existing rows keep
-- their name-based routing (pharmacy_partner_id stays NULL → matched by name).
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pharmacy_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy ON prescriptions(pharmacy_partner_id);
