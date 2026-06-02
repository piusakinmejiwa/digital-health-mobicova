-- Granular per-tenant roles for dashboard users (Q2).
--
-- A user's org-level role governs what they can do with their organisation's
-- data; it is independent of users.is_platform_admin (which governs the
-- platform-wide Admin Console). The three roles:
--   admin   — full control of the tenant, incl. its users and billing
--   manager — manage members and clinical/insurance services, no user/billing admin
--   analyst — read-only access to the organisation's data
--
-- Existing rows: pre-existing dashboard logins were 'admin'; legacy 'member'
-- rows (and anything unexpected) collapse to the safest role, 'analyst'.
UPDATE users
   SET role = 'analyst'
 WHERE role IS NULL OR role NOT IN ('admin', 'manager', 'analyst');

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'admin';

-- Enforce the closed role set at the database boundary. Wrapped in a guard so
-- the migration stays idempotent (CHECK constraints have no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'manager', 'analyst'));
  END IF;
END $$;
