-- ───────────────────────────────────────────────────────────────────────────
-- Contact messages — run-in-Supabase-SQL-Editor edition (migration 040)
-- ───────────────────────────────────────────────────────────────────────────
-- Stores submissions from the public /contact form. Idempotent.

CREATE TABLE IF NOT EXISTS contact_messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(160) NOT NULL DEFAULT '',
    email        VARCHAR(255) NOT NULL,
    phone        VARCHAR(40)  NOT NULL DEFAULT '',
    organisation VARCHAR(160) NOT NULL DEFAULT '',
    enquiry_type VARCHAR(40)  NOT NULL DEFAULT '',
    subject      VARCHAR(200) NOT NULL DEFAULT '',
    message      TEXT         NOT NULL DEFAULT '',
    consent      BOOLEAN      NOT NULL DEFAULT false,
    source       VARCHAR(40)  NOT NULL DEFAULT 'contact',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at DESC);

INSERT INTO _migrations (name) VALUES ('040_contact_messages.sql') ON CONFLICT (name) DO NOTHING;

SELECT count(*) AS contact_table_ready FROM information_schema.tables WHERE table_name = 'contact_messages';
