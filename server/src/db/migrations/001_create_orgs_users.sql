CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- A partner organisation that uses MobiCova's health infrastructure:
-- an employer, insurer, telco, fintech, or cooperative.
CREATE TABLE organisations (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   VARCHAR(255) NOT NULL,
    slug                   VARCHAR(100) UNIQUE NOT NULL,
    partner_type           VARCHAR(50) DEFAULT 'employer',
    country                VARCHAR(80) DEFAULT 'Nigeria',
    plan_tier              VARCHAR(50) DEFAULT 'starter',
    stripe_customer_id     VARCHAR(255),
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Admin users who manage a partner organisation on the platform.
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    role          VARCHAR(20) DEFAULT 'admin',
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
