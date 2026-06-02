-- Platform admins manage the platform-wide catalog (partners + insurance plans)
-- through the in-app Admin UI. This is distinct from a partner org's own 'admin'
-- role (which only governs that org's members). A user is also treated as a
-- platform admin if their email is in the PLATFORM_ADMIN_EMAILS env allowlist,
-- so the first admin can be granted access without a manual DB update.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;
