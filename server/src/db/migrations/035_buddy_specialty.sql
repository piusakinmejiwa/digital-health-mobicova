-- Specialty buddies: record which buddy persona answered, for the safety-review
-- queue and analytics. Existing rows / channels default to the general buddy.
ALTER TABLE buddy_messages ADD COLUMN IF NOT EXISTS specialty VARCHAR(40) NOT NULL DEFAULT 'general';
