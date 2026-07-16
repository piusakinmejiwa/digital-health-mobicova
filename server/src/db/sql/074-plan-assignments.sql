-- Plan assignments (org hierarchy Phase 3). An HMO/insurer assigns a plan it owns
-- to one of its employer orgs, optionally at a negotiated group premium — the way
-- Nigerian corporate schemes are actually sold (custom rate per employer). An
-- employer's available plans = its active assignments; a group enrolment resolves
-- its premium from the assignment (NULL = the plan's list premium).
-- See docs/ORG-HIERARCHY-DESIGN.md.

CREATE TABLE IF NOT EXISTS plan_assignments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_org_id    UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plan_id            UUID NOT NULL REFERENCES insurance_plans(id) ON DELETE CASCADE,
  assigned_by_org_id UUID REFERENCES organisations(id),   -- the HMO/insurer that assigned it
  negotiated_premium NUMERIC(12,2),                         -- NULL → use the plan's list premium
  status             VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employer_org_id, plan_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_assignments_employer ON plan_assignments(employer_org_id);
CREATE INDEX IF NOT EXISTS idx_plan_assignments_plan ON plan_assignments(plan_id);
