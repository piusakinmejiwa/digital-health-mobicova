-- ───────────────────────────────────────────────────────────────────────────
-- Blog posts — run-in-Supabase-SQL-Editor edition (migration 039)
-- ───────────────────────────────────────────────────────────────────────────
-- Adds the blog_posts table powering the public /blog section. Idempotent.
-- Scheduling: a post shows publicly when status='published' AND published_at<=now().

CREATE TABLE IF NOT EXISTS blog_posts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug             VARCHAR(200) UNIQUE NOT NULL,
    title            VARCHAR(200) NOT NULL,
    excerpt          TEXT         NOT NULL DEFAULT '',
    body             TEXT         NOT NULL DEFAULT '',
    cover_image_url  TEXT         NOT NULL DEFAULT '',
    author           VARCHAR(120) NOT NULL DEFAULT 'MobiCova Health',
    tags             JSONB        NOT NULL DEFAULT '[]'::jsonb,
    status           VARCHAR(12)  NOT NULL DEFAULT 'draft',
    published_at     TIMESTAMPTZ,
    meta_title       VARCHAR(200) NOT NULL DEFAULT '',
    meta_description TEXT         NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(status, published_at DESC);

-- Mark migration 039 as applied so `npm run migrate` won't re-run it.
INSERT INTO _migrations (name) VALUES ('039_blog_posts.sql') ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT count(*) AS blog_table_ready FROM information_schema.tables WHERE table_name = 'blog_posts';
