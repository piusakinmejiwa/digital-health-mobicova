-- Two video-call features:
--  1) Geo-routing prescriptions to the nearest pharmacy (member + pharmacy coords).
--  2) Consent-gated call recording (NDPR/GDPR) on consultations.

-- 1) Location data ---------------------------------------------------------
ALTER TABLE members ADD COLUMN IF NOT EXISTS address   TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS city      VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE members ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS address   TEXT NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS city      VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 2) Consent-gated recording ----------------------------------------------
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_consent    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_consent_at TIMESTAMPTZ;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_status     VARCHAR(30) NOT NULL DEFAULT 'none';
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_id         TEXT NOT NULL DEFAULT '';
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_url        TEXT NOT NULL DEFAULT '';
