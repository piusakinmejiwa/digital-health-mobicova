-- =====================================================================
-- 043 · Live video consultations (Daily.co) — paste edition
-- Run this once in the Supabase SQL Editor (the numbered migration in
-- server/src/db/migrations/043_consultation_video.sql is identical).
-- Adds the room reference each video consultation joins.
-- =====================================================================

ALTER TABLE consultations ADD COLUMN IF NOT EXISTS video_room TEXT;

-- Record it as applied so the migration runner skips it.
INSERT INTO _migrations (name) VALUES ('043_consultation_video.sql')
ON CONFLICT (name) DO NOTHING;
