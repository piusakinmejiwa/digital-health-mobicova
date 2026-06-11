-- ───────────────────────────────────────────────────────────────────────────
-- Membership IDs — run-in-Supabase-SQL-Editor edition
-- ───────────────────────────────────────────────────────────────────────────
-- Use this when `npm run migrate` / `npm run backfill:membership-ids` can't
-- reach the database from your local machine (ETIMEDOUT). Paste each block into
-- the Supabase dashboard → SQL Editor and run it there (server-side).
--
-- Mirrors migration 031 + the backfill script. All blocks are idempotent and
-- safe to re-run. Run block 1 BEFORE the new server code serves traffic
-- (the app inserts into membership_id).

-- 1) Column + unique index (same as migration 031_member_membership_id.sql)
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_id VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_membership_id
  ON members(membership_id) WHERE membership_id IS NOT NULL;

-- 2) Backfill existing members: <3-letter org prefix><6 unique digits>
--    e.g. "AXA Mansard Health" -> AXA204517, "Avenetic" -> AVE881023
DO $$
DECLARE
  m RECORD; letters TEXT; pref TEXT; newid TEXT;
BEGIN
  FOR m IN
    SELECT mem.id, o.name AS org_name
    FROM members mem JOIN organisations o ON mem.org_id = o.id
    WHERE mem.membership_id IS NULL
  LOOP
    letters := upper(regexp_replace(coalesce(m.org_name, ''), '[^A-Za-z]', '', 'g'));
    pref := CASE WHEN length(letters) = 0 THEN 'MOB' ELSE rpad(left(letters, 3), 3, 'X') END;
    LOOP
      newid := pref || lpad((floor(random() * 1000000))::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM members WHERE membership_id = newid);
    END LOOP;
    UPDATE members SET membership_id = newid WHERE id = m.id;
  END LOOP;
END $$;

-- 3) Verify
SELECT membership_id, full_name FROM members ORDER BY membership_id LIMIT 10;
