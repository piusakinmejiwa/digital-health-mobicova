-- AI Health Assistant triage sessions. Stores the conversation and the AI's
-- structured triage outcome. The assistant guides users to the right level of
-- care; it does not diagnose.
CREATE TABLE triage_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    member_id       UUID REFERENCES members(id) ON DELETE SET NULL,
    messages        JSONB DEFAULT '[]',
    triage_level    VARCHAR(30) DEFAULT 'unknown',
    recommendation  TEXT DEFAULT '',
    engine          VARCHAR(20) DEFAULT 'rules',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_triage_org ON triage_sessions(org_id);
CREATE INDEX idx_triage_member ON triage_sessions(member_id);
