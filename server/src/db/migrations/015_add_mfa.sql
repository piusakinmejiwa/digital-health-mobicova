-- Q4: Multi-factor authentication (TOTP authenticator apps).
-- Per-user, opt-in. SSO logins skip MFA (the IdP owns that factor).
--   totp_secret        base32 shared secret (blank until a setup is started)
--   totp_enabled       true once the user has confirmed a code during setup
--   totp_backup_codes  one-time recovery codes, stored bcrypt-hashed
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[] NOT NULL DEFAULT '{}';
