-- =====================================================================
-- 051 · Platform org — separate platform admins from company admins
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS is_platform BOOLEAN NOT NULL DEFAULT false;

INSERT INTO organisations (name, slug, type, is_platform)
SELECT 'MobiCova Platform', 'mobicova-platform', 'platform', true
WHERE NOT EXISTS (SELECT 1 FROM organisations WHERE is_platform = true);

UPDATE users
   SET org_id = (SELECT id FROM organisations WHERE is_platform = true ORDER BY created_at LIMIT 1)
 WHERE is_platform_admin = true;

INSERT INTO _migrations (name) VALUES ('051_platform_org.sql')
ON CONFLICT (name) DO NOTHING;
