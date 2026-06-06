-- Prescription fulfilment & tracking: how the medicine reaches the member
-- (pickup at the pharmacy, or courier delivery) and the status timeline.
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS fulfilment_method VARCHAR(20) NOT NULL DEFAULT ''; -- '' | pickup | delivery
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS delivery_address TEXT NOT NULL DEFAULT '';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS courier_name VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS tracking_ref VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;       -- prepared / ready for pickup
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;  -- out for delivery
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;   -- collected / delivered
