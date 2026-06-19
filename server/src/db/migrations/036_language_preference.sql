-- Multilingual foundation (Phase 0). Remember each member's preferred language and
-- the language chosen mid-flow on a channel session. Default 'en' keeps every
-- existing member and session on English — no behaviour change until a member opts
-- into another language. Language codes are ISO 639 (e.g. 'en', 'pcm' = Nigerian Pidgin).
ALTER TABLE members ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(8) NOT NULL DEFAULT 'en';
ALTER TABLE intake_sessions ADD COLUMN IF NOT EXISTS language VARCHAR(8) NOT NULL DEFAULT 'en';
