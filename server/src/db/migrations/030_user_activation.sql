-- Account activation (invite) tokens for staff users. When an org is onboarded
-- without a password, the admin receives a "set your password" link instead of
-- a plaintext password. Additive + nullable.
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_expires TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_activation ON users(activation_token_hash);
