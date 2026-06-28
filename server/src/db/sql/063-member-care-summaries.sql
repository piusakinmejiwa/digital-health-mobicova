-- =====================================================================
-- 063 · AI care summaries — paste edition
-- Run once in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS member_care_summaries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    summary      TEXT NOT NULL,
    model        VARCHAR(60) NOT NULL DEFAULT '',
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_summaries_member ON member_care_summaries(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_summaries_org ON member_care_summaries(org_id, created_at DESC);

INSERT INTO _migrations (name) VALUES ('063_member_care_summaries.sql')
ON CONFLICT (name) DO NOTHING;
