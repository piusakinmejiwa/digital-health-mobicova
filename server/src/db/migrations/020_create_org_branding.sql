-- Phase 2: white-label branding. One row per organisation describing how the
-- member-facing surfaces (portal, WhatsApp, member card) should look. Logo is a
-- letter-mark for now (binary upload is a later add-on).
CREATE TABLE IF NOT EXISTS org_branding (
    org_id            UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
    display_name      VARCHAR(120) NOT NULL DEFAULT '',
    logo_letter       VARCHAR(4)   NOT NULL DEFAULT '',
    primary_color     VARCHAR(9)   NOT NULL DEFAULT '#0a7b7b',
    accent_color      VARCHAR(9)   NOT NULL DEFAULT '#12a3a3',
    support_contact   VARCHAR(160) NOT NULL DEFAULT '',
    whatsapp_greeting TEXT         NOT NULL DEFAULT '',
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
