-- =====================================================================
-- 050 · Org onboarding Phase 2 — document uploads + HR integration
-- Run once in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS org_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    doc_type     VARCHAR(40)  NOT NULL DEFAULT 'other',
    file_name    VARCHAR(255) NOT NULL DEFAULT '',
    storage_path TEXT         NOT NULL DEFAULT '',
    content_type VARCHAR(120) NOT NULL DEFAULT '',
    size_bytes   INTEGER,
    uploaded_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_documents_org ON org_documents(org_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS org_hr_integration (
    org_id         UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
    provider       VARCHAR(120) NOT NULL DEFAULT '',
    api_base_url   TEXT         NOT NULL DEFAULT '',
    api_key        TEXT         NOT NULL DEFAULT '',
    sync_cadence   VARCHAR(20)  NOT NULL DEFAULT 'manual',
    status         VARCHAR(20)  NOT NULL DEFAULT 'disconnected',
    last_synced_at TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO _migrations (name) VALUES ('050_org_documents_hr.sql')
ON CONFLICT (name) DO NOTHING;
