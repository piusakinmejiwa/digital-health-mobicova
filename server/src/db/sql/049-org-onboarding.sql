-- =====================================================================
-- 049 · Organisation onboarding (profile columns + JSONB questionnaire)
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS registered_name   VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS trading_name      VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS rc_number         VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS tin               VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS industry          VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS company_size      VARCHAR(20)  NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS state             VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS postal_code       VARCHAR(40)  NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS website           VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS contact_name      VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS contact_role      VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS contact_phone     VARCHAR(40)  NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS contact_email     VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS member_estimate   INTEGER;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(30)  NOT NULL DEFAULT 'draft';

CREATE TABLE IF NOT EXISTS org_onboarding (
    org_id       UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
    data         JSONB        NOT NULL DEFAULT '{}',
    status       VARCHAR(30)  NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO _migrations (name) VALUES ('049_org_onboarding.sql')
ON CONFLICT (name) DO NOTHING;
