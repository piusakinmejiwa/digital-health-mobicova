-- Blog / articles for the public site (SEO). Platform-level content.
-- Scheduling is handled without a cron: a post is publicly visible when
-- status = 'published' AND published_at <= now(). Setting published_at in the
-- future = a scheduled post that auto-appears at that time.
CREATE TABLE IF NOT EXISTS blog_posts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug             VARCHAR(200) UNIQUE NOT NULL,
    title            VARCHAR(200) NOT NULL,
    excerpt          TEXT         NOT NULL DEFAULT '',
    body             TEXT         NOT NULL DEFAULT '',          -- Markdown
    cover_image_url  TEXT         NOT NULL DEFAULT '',
    author           VARCHAR(120) NOT NULL DEFAULT 'MobiCova Health',
    tags             JSONB        NOT NULL DEFAULT '[]'::jsonb,
    status           VARCHAR(12)  NOT NULL DEFAULT 'draft',     -- 'draft' | 'published'
    published_at     TIMESTAMPTZ,                               -- scheduled/publish time
    meta_title       VARCHAR(200) NOT NULL DEFAULT '',          -- SEO (falls back to title)
    meta_description TEXT         NOT NULL DEFAULT '',          -- SEO (falls back to excerpt)
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- Fast lookup for the public "published and due" feed.
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(status, published_at DESC);
