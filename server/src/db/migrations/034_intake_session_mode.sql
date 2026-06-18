-- WhatsApp can now do two things: enrol a member (intake) or chat with the free
-- AI Health Buddy. A per-session mode toggles between them; default keeps the
-- existing enrolment behaviour unchanged.
ALTER TABLE intake_sessions ADD COLUMN IF NOT EXISTS mode VARCHAR(12) NOT NULL DEFAULT 'intake';
