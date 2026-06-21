-- Phase 2 — masked phone calls (Africa's Talking / Twilio).
-- The doctor's real number to bridge to (never shown to the member), plus a
-- reference + status so the answer/event callbacks can match and log the call.
ALTER TABLE providers     ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS call_ref TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS call_status VARCHAR(30);
