-- PharmaRun (external pharmacy network) fulfilment.
-- When a prescription is routed to PharmaRun, we store their order reference +
-- status alongside our own fulfilment_status, so members keep one tracking view.
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS fulfilment_provider VARCHAR(20)  NOT NULL DEFAULT 'internal'; -- 'internal' | 'pharmarun'
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS external_order_id   TEXT         NOT NULL DEFAULT '';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS external_status     VARCHAR(40)  NOT NULL DEFAULT '';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS tracking_url        TEXT         NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_prescriptions_external_order ON prescriptions(external_order_id);
