-- Lets platform admins suspend a partner organisation (tenant) without deleting
-- it. Login is gated on this flag, so suspending an org blocks all its users.
ALTER TABLE organisations
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
