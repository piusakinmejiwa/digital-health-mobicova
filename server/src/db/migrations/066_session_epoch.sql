-- Token revocation for member + provider sessions ("sign out everywhere").
-- Their JWTs carry this epoch; bumping it invalidates every outstanding token for
-- that member/provider on the next request (lost-device / compromised-account
-- response). Staff already had per-device revocation via user_sessions (058); this
-- brings the other two auth domains up to a global kill switch.

ALTER TABLE members   ADD COLUMN IF NOT EXISTS session_epoch INT NOT NULL DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS session_epoch INT NOT NULL DEFAULT 0;
