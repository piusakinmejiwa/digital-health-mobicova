-- =====================================================================
-- 053 · Provider MDCN number + partner (network) compliance documents
-- Run once in the Supabase SQL Editor.
-- =====================================================================

ALTER TABLE providers ADD COLUMN IF NOT EXISTS mdcn_number VARCHAR(40) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS partner_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id   UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    doc_type     VARCHAR(40)  NOT NULL DEFAULT 'other',
    file_name    VARCHAR(255) NOT NULL DEFAULT '',
    storage_path TEXT         NOT NULL DEFAULT '',
    content_type VARCHAR(120) NOT NULL DEFAULT '',
    size_bytes   INTEGER,
    uploaded_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_documents_partner ON partner_documents(partner_id, uploaded_at DESC);

INSERT INTO _migrations (name) VALUES ('053_provider_mdcn_partner_docs.sql')
ON CONFLICT (name) DO NOTHING;
