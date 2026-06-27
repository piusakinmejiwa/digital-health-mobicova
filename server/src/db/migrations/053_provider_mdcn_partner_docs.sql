-- Doctor-network onboarding: professional registration number on providers
-- (MDCN for doctors, PCN for pharmacists) + compliance documents for a partner
-- network (mirrors org_documents, keyed to partners).

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
