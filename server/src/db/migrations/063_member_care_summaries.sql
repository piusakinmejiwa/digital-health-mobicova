-- AI-generated clinical care summaries for members. Each generation is stored
-- (history kept) so the latest can be shown on the profile, summaries are
-- countable for the AI activity card, and every one is auditable. Contains PHI
-- (conditions/medications in prose) — only ever served to PHI-permitted roles.

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
