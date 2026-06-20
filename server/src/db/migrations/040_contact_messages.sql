-- Contact form submissions from the public site (/contact). Captures full
-- enquiry details. No PHI — contact and enquiry information only.
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
