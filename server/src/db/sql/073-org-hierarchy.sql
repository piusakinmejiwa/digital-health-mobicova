-- Org hierarchy foundation (Phase 1). Adds the tree link and the plan-ownership
-- columns that the coverage-chain access model needs, plus a plan `kind`. All
-- additive and nullable — with no parents set and no columns populated, the
-- platform behaves exactly as before. See docs/ORG-HIERARCHY-DESIGN.md.

-- Self-referential parent: employer → HMO → insurer. NULL at the top of a chain
-- (a standalone HMO, or an insurer). No ON DELETE cascade — deleting a parent must
-- not silently remove its children; the app guards re-parenting/deletion.
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS parent_org_id UUID REFERENCES organisations(id);
CREATE INDEX IF NOT EXISTS idx_orgs_parent ON organisations(parent_org_id);

-- Plans: which org OFFERS the plan (the HMO, or a self-carrying HMO/insurer) and
-- what KIND it is. `underwriter_org_id` (the risk carrier) already exists (028).
ALTER TABLE insurance_plans
  ADD COLUMN IF NOT EXISTS offered_by_org_id UUID REFERENCES organisations(id),
  ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'group';   -- 'group' | 'individual'
CREATE INDEX IF NOT EXISTS idx_plans_offered_by ON insurance_plans(offered_by_org_id);

-- Bookkeeping: record this migration so /health and the CI migration gate stay in
-- sync when applied by pasting (the npm run migrate runner records it automatically).
INSERT INTO _migrations (name) VALUES ('073_org_hierarchy.sql') ON CONFLICT (name) DO NOTHING;
