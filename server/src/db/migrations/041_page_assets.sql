-- Hero images for the public content pages (About, Telemedicine, etc.), managed
-- from the admin so images can be set/changed without code edits or redeploys.
-- One row per page slug; image_url points at the uploaded (or AI-generated) image.
CREATE TABLE IF NOT EXISTS page_assets (
    slug       VARCHAR(80) PRIMARY KEY,
    image_url  TEXT        NOT NULL DEFAULT '',
    prompt     TEXT        NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
