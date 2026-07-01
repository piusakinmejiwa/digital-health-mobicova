-- Forgotten-password reset tokens for staff users and providers (doctors/
-- pharmacists). Same hashed-token pattern as account activation (030): only the
-- SHA-256 hash is stored; the raw token travels solely in the emailed link, with
-- a short expiry. (Members are passwordless / OTP, so they have no reset flow.)

ALTER TABLE users     ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE users     ADD COLUMN IF NOT EXISTS reset_expires    TIMESTAMPTZ;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS reset_expires    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_reset     ON users(reset_token_hash);
CREATE INDEX IF NOT EXISTS idx_providers_reset ON providers(reset_token_hash);
