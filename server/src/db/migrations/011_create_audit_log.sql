-- Append-only trail of privileged actions (org/user/catalog management) for
-- security review and tenant accountability. Never updated or deleted by the app.
CREATE TABLE IF NOT EXISTS audit_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id  UUID,                       -- who did it (nullable: actor may be deleted later)
    actor_email    VARCHAR(255),               -- captured at write time so the trail survives user deletion
    action         VARCHAR(80) NOT NULL,       -- e.g. 'org.create', 'user.suspend', 'plan.delete'
    target_type    VARCHAR(40),                -- 'organisation' | 'user' | 'plan' | 'partner'
    target_id      VARCHAR(64),                -- id of the affected record
    target_label   VARCHAR(255),               -- human-readable name/email for display
    org_id         UUID,                       -- tenant the action relates to, when applicable
    metadata       JSONB DEFAULT '{}'::jsonb,  -- small structured detail (changed fields, etc.)
    ip             VARCHAR(64),
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_user_id);
