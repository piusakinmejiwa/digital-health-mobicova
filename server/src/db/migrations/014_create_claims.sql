-- Insurance claims raised by (or on behalf of) members and adjudicated by the
-- partner organisation. MobiCova owns the claims *workflow and record*; the
-- NAICOM-licensed underwriter partner remains the risk carrier. A payout is
-- tracked as a status transition here, never executed by this platform.
CREATE TABLE IF NOT EXISTS claims (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    -- Optional link to the cover the claim is made against. SET NULL keeps the
    -- claim history intact if an enrolment/plan is later removed.
    enrolment_id    UUID REFERENCES enrolments(id) ON DELETE SET NULL,
    plan_id         UUID REFERENCES insurance_plans(id) ON DELETE SET NULL,
    reference       VARCHAR(20) NOT NULL UNIQUE,         -- human-readable, e.g. CLM-AB12CD
    claim_type      VARCHAR(40) NOT NULL DEFAULT 'outpatient',
    provider_name   VARCHAR(255) NOT NULL DEFAULT '',     -- hospital/clinic/pharmacy that delivered care
    service_date    DATE,
    amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency        VARCHAR(10) NOT NULL DEFAULT 'NGN',
    description     TEXT NOT NULL DEFAULT '',
    -- submitted -> under_review -> approved/rejected; approved -> paid.
    status          VARCHAR(20) NOT NULL DEFAULT 'submitted',
    decision_note   TEXT NOT NULL DEFAULT '',
    decided_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    decided_at      TIMESTAMPTZ,
    submitted_via   VARCHAR(20) NOT NULL DEFAULT 'dashboard', -- dashboard | member_portal | whatsapp | ussd
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_org ON claims(org_id);
CREATE INDEX IF NOT EXISTS idx_claims_member ON claims(member_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- Supporting evidence attached to a claim (receipts, referral letters, scans).
-- Files live in Supabase Storage; we persist a signed URL + the storage path so
-- the URL can be regenerated. When Storage is not configured the claim still
-- works — it simply carries no documents.
CREATE TABLE IF NOT EXISTS claim_documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id      UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    label         VARCHAR(120) NOT NULL DEFAULT 'Supporting document',
    file_name     VARCHAR(255) NOT NULL DEFAULT '',
    file_url      TEXT NOT NULL,
    storage_path  TEXT NOT NULL DEFAULT '',
    content_type  VARCHAR(120) NOT NULL DEFAULT '',
    size_bytes    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_documents_claim ON claim_documents(claim_id);
