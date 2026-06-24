-- =====================================================================
-- 047 · PharmaRun external fulfilment — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS fulfilment_provider VARCHAR(20)  NOT NULL DEFAULT 'internal';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS external_order_id   TEXT         NOT NULL DEFAULT '';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS external_status     VARCHAR(40)  NOT NULL DEFAULT '';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS tracking_url        TEXT         NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_prescriptions_external_order ON prescriptions(external_order_id);

INSERT INTO _migrations (name) VALUES ('047_pharmarun_fulfilment.sql')
ON CONFLICT (name) DO NOTHING;
