# Organisation Hierarchy Design — Insurer → HMO → Employer → Member

Adds a real multi-tier structure to the (currently flat) organisation model, to match
how the Nigerian market works. Design agreed 2026-07-16.

## Context

Two real chains, insurer optional at the top:

```
Insurance Company (NAICOM)  →  HMO (NHIA)  →  Company / Employer  →  Member
                               HMO (NHIA)  →  Company / Employer  →  Member   (standalone HMO)
```

**Decisions locked:**
1. **`hmo` is a new, distinct org type** (separate from `underwriter`/insurer).
2. **Direct members allowed** — individuals/families can belong to an HMO or insurer with
   no employer in between (retail plans), as well as via an employer.
3. **Full aggregate subtree access now** — parent tiers see combined data across their
   whole branch, not just drill-down.

## What exists today (for reference)

Flat `organisations` table discriminated by `type` (`orgTypes.ts`); no hierarchy.
Insurers **and** HMOs are both `type='underwriter'`. Members attach to one demand-class
org via `members.org_id`. Isolation = exact `org_id = $me` on every table. PHI is
field-projected by type (`memberProjection.ts`, `PHI_OWNER_TYPES = {underwriter}`).

## Model changes

1. **`organisations.parent_org_id UUID NULL REFERENCES organisations(id)`** — the tree.
   A standalone HMO has `parent_org_id = NULL`; an insurer-backed HMO points to the insurer;
   an employer points to its HMO. One nullable column expresses both chains (and leaves room
   for a future broker tier without further schema).
2. **New org type `hmo`** in `orgTypes.ts` — demand class, `ownsMembers: true`, PHI owner.
   Types now: `underwriter` (insurer/NAICOM), `hmo` (NHIA), `company` (employer) + existing
   supply/integration types.
3. **Members attach at any demand tier** — `members.org_id` may reference a `company`, `hmo`
   or `underwriter` org. No column change; just more valid parents (retail members sit
   directly under the HMO/insurer).
4. **Plans** gain **`offered_by_org_id`** (the HMO or insurer that sells the plan) alongside
   the existing `underwriter_org_id` (the risk carrier). Standalone HMO: both point to it.

## Access model — two orthogonal axes

The key idea: *which rows* you see and *how much of each row* you see are separate.

- **Row-level = subtree scope.** A helper `visibleOrgIds(actorOrgId)` returns `{self} ∪ all
  descendants` (recursive over `parent_org_id`). Scoping shifts from `org_id = $1` to
  `org_id = ANY($ids)`. A leaf tenant (a company) gets a **one-element array → behaviour
  identical to today**; an HMO gets its branch; an insurer gets everything beneath it.
- **Field-level = PHI projection by type.** Extend `PHI_OWNER_TYPES` to `{underwriter, hmo}`.
  Employers stay **PHI-limited** (existing member-privacy design) *even though they're the
  leaf* — here the child (employer) sees **less** than its parent (HMO), because PHI is
  granted by org **type**, not by tree depth. Subtree picks the rows; projection picks the fields.

## Writes under a hierarchy

A parent-tier actor (HMO/insurer) creating a member/enrolment must **target a specific child
org** within its subtree; the target is validated ∈ `visibleOrgIds(actor)`. Reuses the
existing "act-as" pattern for context where useful. Leaf tenants are unaffected.

## Roles

No new role enum. The per-tenant role (`admin`/`manager`/`analyst`) still governs *within*
an org; **type + hierarchy + subtree scope** provide downward visibility. An "HMO admin" is
simply an `admin` of the HMO org. Platform admin is unchanged.

## Migration & backwards compatibility

Additive. Add `parent_org_id` and `plans.offered_by_org_id` (both nullable). With no parents
set and single-element scope arrays, **the platform behaves exactly as today** — the change
only activates as orgs are linked into a tree during onboarding. Existing `underwriter` orgs
that are actually HMOs can be re-typed to `hmo` case by case.

## Phased implementation

- **Phase 1 — foundation (no behaviour change):** schema (`parent_org_id`,
  `plans.offered_by_org_id`) + `hmo` type in `orgTypes.ts` + `visibleOrgIds()` helper +
  admin UI to set an org's parent and create HMO orgs. Nothing re-scopes yet.
- **Phase 2 — subtree reads:** switch core scoped reads (members, enrolments, claims,
  dashboards, reports) from `= org_id` to `= ANY(visibleOrgIds)`; extend PHI projection to
  `hmo`. Endpoint-by-endpoint, each with tests. This is the careful part (big blast radius).
- **Phase 3 — parent-tier UX:** HMO/insurer dashboards that aggregate across the branch;
  drill-down into a child; write-targeting a child org.
- **Phase 4 — settlement (if needed):** an HMO margin in the premium split (the ledger
  already snapshots rates, so it extends cleanly).

## Risks

- **Blast radius** — `org_id` scoping is inline in many queries; Phase 2 must be methodical
  (per endpoint, tested), not a blanket find-replace.
- **Performance** — resolve the subtree once per request and cache it; the tree is shallow
  (≤4 levels) so it's cheap. A materialised `path` column can be added if needed.
- **PHI up the chain** — insurer/HMO now see members' PHI across their branch (legitimate:
  they carry risk / manage care), but this must be reflected in DPAs and member consent
  (NDPR) and in the audit log.
- **Consent/residency** — more orgs can see a member's data; surface this in onboarding.

See also `docs/PLATFORM-ORG-MODEL-PLAN.md` (today's flat model) and `orgTypes.ts`.
