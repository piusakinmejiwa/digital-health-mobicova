-- Live video consultations (Phase 1 — Daily.co).
-- Stores the per-consultation Daily room URL so both the member and the
-- clinician join the same room. Nullable: only set when a call is started.
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS video_room TEXT;
