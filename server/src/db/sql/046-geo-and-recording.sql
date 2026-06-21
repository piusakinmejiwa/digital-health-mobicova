-- =====================================================================
-- 046 · Nearest-pharmacy geo + consent-gated recording — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS address   TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS city      VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE members ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS address   TEXT NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS city      VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_consent    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_consent_at TIMESTAMPTZ;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_status     VARCHAR(30) NOT NULL DEFAULT 'none';
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_id         TEXT NOT NULL DEFAULT '';
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS recording_url        TEXT NOT NULL DEFAULT '';

-- Optional demo coordinates so "nearest pharmacy" is testable before you geocode
-- real addresses (Lagos points). Uncomment + adjust, or set via the admin forms.
-- UPDATE members SET city='Lagos', latitude=6.4281, longitude=3.4216 WHERE email='amaka.obi@member.demo';
-- UPDATE organisations SET city='Lagos', latitude=6.4350, longitude=3.4500 WHERE type='pharmacy';

INSERT INTO _migrations (name) VALUES ('046_geo_and_recording.sql')
ON CONFLICT (name) DO NOTHING;
