-- Optional headshot/photo URL for a provider, shown in the member "talk to a
-- doctor" list and on the call screen. May be a local path (/images/…) or a URL.
ALTER TABLE providers ADD COLUMN IF NOT EXISTS photo_url TEXT NOT NULL DEFAULT '';
