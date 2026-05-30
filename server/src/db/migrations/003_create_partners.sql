-- The platform partner ecosystem: telemedicine providers, insurers/HMOs, pharmacy
-- networks, diagnostic labs, EHR providers, and distribution partners. Platform-wide
-- (not org-scoped) — MobiCova connects to these, it does not provide the services itself.
CREATE TABLE partners (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    category      VARCHAR(50) NOT NULL,
    description   TEXT DEFAULT '',
    coverage      VARCHAR(120) DEFAULT '',
    licence       VARCHAR(120) DEFAULT '',
    status        VARCHAR(30) DEFAULT 'active',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partners_category ON partners(category);
