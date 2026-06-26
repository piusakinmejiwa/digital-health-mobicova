-- Organisation onboarding — Phase 2: document uploads + HR/payroll integration.

-- Uploaded onboarding documents (CAC cert, tax cert, staff list, company ID
-- template, etc.). Files live in a PRIVATE Supabase bucket; we keep the
-- storage_path so a fresh signed URL can be minted on read.
CREATE TABLE IF NOT EXISTS org_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    doc_type     VARCHAR(40)  NOT NULL DEFAULT 'other', -- cac_certificate|tax_certificate|staff_list|company_id_template|other
    file_name    VARCHAR(255) NOT NULL DEFAULT '',
    storage_path TEXT         NOT NULL DEFAULT '',
    content_type VARCHAR(120) NOT NULL DEFAULT '',
    size_bytes   INTEGER,
    uploaded_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_documents_org ON org_documents(org_id, uploaded_at DESC);

-- Generic HR / payroll integration config (one row per org). The api_key is
-- stored server-side and never returned to the client. Live sync is scaffolded
-- (status + last_synced_at) and wired to a specific HRIS later.
CREATE TABLE IF NOT EXISTS org_hr_integration (
    org_id         UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
    provider       VARCHAR(120) NOT NULL DEFAULT '',
    api_base_url   TEXT         NOT NULL DEFAULT '',
    api_key        TEXT         NOT NULL DEFAULT '',
    sync_cadence   VARCHAR(20)  NOT NULL DEFAULT 'manual', -- manual|daily|weekly
    status         VARCHAR(20)  NOT NULL DEFAULT 'disconnected', -- disconnected|connected
    last_synced_at TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
