-- Separate platform admins from company admins (mutually exclusive).
-- Platform admins live in a single dedicated internal "MobiCova Platform" org
-- and hold NO tenant data; company users live in their tenant org and are never
-- platform admins.

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS is_platform BOOLEAN NOT NULL DEFAULT false;

-- The one platform/system org (idempotent — only ever one).
INSERT INTO organisations (name, slug, type, is_platform)
SELECT 'MobiCova Platform', 'mobicova-platform', 'platform', true
WHERE NOT EXISTS (SELECT 1 FROM organisations WHERE is_platform = true);

-- Move existing platform admins (who were sitting inside tenant orgs) into it.
UPDATE users
   SET org_id = (SELECT id FROM organisations WHERE is_platform = true ORDER BY created_at LIMIT 1)
 WHERE is_platform_admin = true;
