-- Organisation onboarding — a proper B2B intake profile.
-- The high-value, queryable fields are promoted to columns on `organisations`
-- (so they show in the org list / are filterable); the full 8-section
-- questionnaire (with its conditionals, multi-selects, branch lists and
-- agreements) lives in a flexible JSONB profile so it's easy to extend.

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS registered_name   VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS trading_name      VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS rc_number         VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS tin               VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS industry          VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS company_size      VARCHAR(20)  NOT NULL DEFAULT ''; -- micro|small|medium|large
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS state             VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS postal_code       VARCHAR(40)  NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS website           VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS contact_name      VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS contact_role      VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS contact_phone     VARCHAR(40)  NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS contact_email     VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS member_estimate   INTEGER;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(30)  NOT NULL DEFAULT 'draft'; -- draft|submitted

-- Full questionnaire, one row per org.
CREATE TABLE IF NOT EXISTS org_onboarding (
    org_id       UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
    data         JSONB        NOT NULL DEFAULT '{}',
    status       VARCHAR(30)  NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
