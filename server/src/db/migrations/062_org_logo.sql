-- 062 · Organisation logo image
-- White-label branding gains a real logo image (public URL) on top of the
-- existing logo-letter fallback. Used on the member app, branded login and the
-- per-org rewards programme.

ALTER TABLE org_branding ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';
