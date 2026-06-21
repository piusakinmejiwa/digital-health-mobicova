-- =====================================================================
-- 044 · Masked phone calls (Phase 2) — paste edition
-- Run once in the Supabase SQL Editor (identical to the numbered migration
-- server/src/db/migrations/044_masked_voice.sql).
-- =====================================================================

ALTER TABLE providers     ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS call_ref TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS call_status VARCHAR(30);

-- For testing: give the demo doctor a real number you can answer, so the bridge
-- has somewhere to dial. Replace with your test phone (E.164, e.g. +2348012345678).
-- UPDATE providers SET phone = '+2348012345678' WHERE email = 'doctor@mobicova.demo';

INSERT INTO _migrations (name) VALUES ('044_masked_voice.sql')
ON CONFLICT (name) DO NOTHING;
