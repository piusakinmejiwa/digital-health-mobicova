-- Human-friendly membership ID per member: <3-letter org prefix><6 digits>
-- (e.g. AXA204517). Used for USSD registration and as a second way to confirm
-- a member. Partial unique index allows NULLs while existing rows are backfilled.
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_id VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_membership_id
  ON members(membership_id) WHERE membership_id IS NOT NULL;
