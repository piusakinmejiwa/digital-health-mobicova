-- =====================================================================
-- 055 · Tenant compliance surface — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS org_compliance (
    org_id            UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
    dpa_accepted_at   TIMESTAMPTZ,
    dpa_accepted_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    dpa_accepted_name TEXT        NOT NULL DEFAULT '',
    dpa_version       TEXT        NOT NULL DEFAULT '',
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_export_requests (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    requester    TEXT        NOT NULL DEFAULT '',
    scope        TEXT        NOT NULL DEFAULT 'all',
    status       TEXT        NOT NULL DEFAULT 'requested',
    note         TEXT        NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_data_export_org ON data_export_requests(org_id, created_at DESC);

INSERT INTO _migrations (name) VALUES ('055_org_compliance.sql')
ON CONFLICT (name) DO NOTHING;
