-- A member is an individual (employee, policyholder, subscriber) enrolled under a
-- partner organisation. The health profile fields form the EHR-lite shared layer.
CREATE TABLE members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    full_name           VARCHAR(255) NOT NULL,
    phone               VARCHAR(40) DEFAULT '',
    email               VARCHAR(255) DEFAULT '',
    date_of_birth       DATE,
    gender              VARCHAR(20) DEFAULT '',
    channel             VARCHAR(30) DEFAULT 'app',
    blood_group         VARCHAR(10) DEFAULT '',
    allergies           TEXT[] DEFAULT '{}',
    chronic_conditions  TEXT[] DEFAULT '{}',
    current_medications TEXT[] DEFAULT '{}',
    status              VARCHAR(30) DEFAULT 'active',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_members_org ON members(org_id);
