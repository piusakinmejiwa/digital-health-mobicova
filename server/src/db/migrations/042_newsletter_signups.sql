-- Newsletter sign-ups from the public home page. Email is unique (re-subscribing
-- updates the name/phone). Contact details only, no PHI.
CREATE TABLE IF NOT EXISTS newsletter_signups (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(160) NOT NULL DEFAULT '',
    email      VARCHAR(255) NOT NULL UNIQUE,
    phone      VARCHAR(40)  NOT NULL DEFAULT '',
    consent    BOOLEAN      NOT NULL DEFAULT false,
    source     VARCHAR(40)  NOT NULL DEFAULT 'home',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
