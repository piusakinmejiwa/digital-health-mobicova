-- Q10: Member self-service portal — passwordless OTP login.
--
-- Members never get a password. They prove ownership of a phone or email already
-- on their member record by entering a one-time code. Codes are stored hashed
-- (bcrypt), expire quickly, are single-use, and cap failed attempts.
CREATE TABLE IF NOT EXISTS member_otps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    code_hash    TEXT NOT NULL,
    channel      VARCHAR(20) NOT NULL DEFAULT 'none', -- whatsapp / sms / email / none(dev)
    destination  VARCHAR(255) NOT NULL DEFAULT '',     -- masked phone/email the code went to
    attempts     INT NOT NULL DEFAULT 0,
    consumed     BOOLEAN NOT NULL DEFAULT false,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_otps_member ON member_otps(member_id);
CREATE INDEX IF NOT EXISTS idx_member_otps_active
    ON member_otps(member_id, consumed, expires_at);

-- Track the last time a member signed in to the portal (nice-to-have for the
-- partner's member view; harmless if unused).
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_portal_login_at TIMESTAMPTZ;
