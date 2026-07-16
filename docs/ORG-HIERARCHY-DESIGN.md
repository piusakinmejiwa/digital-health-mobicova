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

## Plans, assignment & pricing

- A plan is **owned by its offering HMO** (`offered_by_org_id`) and optionally **underwritten
  by an insurer** (`underwriter_org_id`); a standalone HMO self-carries (underwriter null).
- Plans carry a **kind**: `group` (corporate) or `individual` (retail).
- **Per-employer assignment + negotiated pricing:** a new `plan_assignments` layer links a
  plan to an employer with an optional **negotiated premium** and **benefit override**. An
  employer's available plans = its assignments; a group enrolment resolves its premium from
  the assignment, not the plan's list price. Matches how Nigerian corporate schemes are sold
  (custom benefit table + negotiated group rate per employer).
- **Retail members** enrol directly in an `individual` plan at its set price — no assignment.
- `insurance_plans.monthly_premium` stays as the list/retail price and default. Model the
  assignment layer now; build it in a later phase.

## Access model — two orthogonal axes

The key idea: *which rows* you see and *how much of each row* you see are separate.

- **Row-level = coverage chain (via plans).** Access follows the plan, not a rigid org tree —
  this handles employers split across multiple HMOs and HMOs using multiple insurers, because
  a plan has exactly one offering HMO and one (optional) underwriter.
  - **Employer** sees members it administers: `members.org_id = employer`.
  - **HMO** sees members enrolled in the plans it offers: members via `enrolments → plans
    where offered_by_org_id = hmo`. Spans employers; excludes members on another HMO's plan.
  - **Insurer** sees members in the plans it underwrites: `plans where underwriter_org_id = insurer`.
  A helper resolves the right predicate per tier. `parent_org_id` is retained only as the
  **administrative/default** relationship (an employer's primary HMO — onboarding, billing
  owner, default plan catalogue), NOT the access mechanism.
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

## Premium split & settlement

**MobiCova is a system of record + facilitator, NOT a money-mover** (decision 2026-07-16). It
computes and records who is owed what; the premium is collected through a licensed rail
(Paystack split-payments / subaccounts, or a CBN-licensed channel partner like PalmPay) and
settles directly to the HMO/insurer. MobiCova takes its platform fee **at source via the
rail's split**, and never custodies client funds — keeping it out of CBN payment-licensing and
NAICOM premium-trust scope. Regulated clients (AXA/HMOs) hold premiums under their own licences.
Becoming a money-mover (via a licensed partner) remains a future option, not foreclosed.

Waterfall — extend the existing `premium_transactions` ledger (rates snapshotted per txn):

```
gross premium
  − distribution commission   → channel partner (if sold via one)
  − MobiCova platform fee      → MobiCova
  − statutory levy             → regulator (where applicable)
  = risk premium
      − HMO margin             → HMO (capitation / admin)
      = net underwriting prem. → insurer  (or kept by the HMO if standalone)
```

Add an `hmo_margin_amount` leg + the HMO as a party; the final leg is conditional on an
underwriter being present.

## Claims

Claims ride the same coverage chain (claim → member → enrolment → plan → HMO/insurer).

- **The HMO adjudicates** (eligibility, benefits, approve/deny) — MobiCova provides the
  workflow, not the decision; maps to the existing `analyst` reviewer role as HMO users.
- **Visibility:** HMO sees claims for members on the plans it offers; insurer sees claims on
  plans it underwrites (risk/reserving); provider sees its own submissions; **employer sees no
  individual claims** — aggregate utilisation only (existing member-privacy design).
- **Payment stays Model A:** the HMO pays the provider from the risk pool; MobiCova records it.
- **Optional later:** require insurer sign-off on claims above a ₦ threshold (excess/reinsurance).

## Onboarding — who creates / links whom

- **Platform admin** provisions **insurer + HMO** orgs and their parent links (regulated,
  low-volume, high-trust, contract-gated).
- **HMO admin self-onboards employers** — creates the employer org under itself
  (`parent_org_id = hmo`) and assigns plans. New delegated capability; keeps MobiCova off the
  critical path as HMOs sign up many employers.
- **Employer** onboards members (existing wizard / CSV / join code / WhatsApp / USSD).
- **Retail members** self-enrol directly under an HMO (public flow / HMO join code).
- Platform admin retains oversight + "view as" across the tree.

## Re-parenting — employer switches HMO

Coverage-chain makes this clean — **not a data migration**:

- End the employer's enrolments on the old HMO's plans; assign + enrol on the new HMO's plans;
  update `parent_org_id`.
- **Access shifts automatically** — the old HMO loses live visibility when its enrolments end;
  the new HMO gains it. `members.org_id` (the employer) is unchanged, so nothing moves.
- **History retained** — claims/data from the old coverage period stay on record (the old HMO
  adjudicated them; regulatory retention), but no new data flows to them.
- **Consent** updates in the switch flow (the new HMO now sees the member's data) — per NDPR.

## Migration & backwards compatibility

Additive. Add `parent_org_id` and `plans.offered_by_org_id` (both nullable). With no parents
set and single-element scope arrays, **the platform behaves exactly as today** — the change
only activates as orgs are linked into a tree during onboarding. Existing `underwriter` orgs
that are actually HMOs can be re-typed to `hmo` case by case.

## Phased implementation

- **Phase 1 — foundation (no behaviour change):** schema (`organisations.parent_org_id`; new
  `hmo` type in `orgTypes.ts` as a demand/PHI-owner; `insurance_plans.offered_by_org_id` +
  `kind` group|individual); the coverage-chain access resolver (given an actor org, yields its
  member predicate) wired but not yet applied; admin UI to create HMO/insurer orgs + set parent
  links. Additive — single-tenant behaviour unchanged until orgs are linked.
- **Phase 2 — coverage-chain reads + HMO onboarding:** apply the resolver to core reads
  (members, enrolments, claims, dashboards, reports) via the plan join; extend PHI projection to
  `hmo`; endpoint-by-endpoint with tests (the careful, big-blast-radius part). HMO console to
  self-onboard employer orgs + assign plans.
- **Phase 3 — plans, pricing & parent-tier UX:** `plan_assignments` (employer↔plan, negotiated
  premium / benefit override); enrolments resolve premium from the assignment; retail
  individual-plan flow. HMO/insurer aggregate dashboards, drill-down, write-targeting a child.
- **Phase 4 — settlement + claims chain:** extend `premium_transactions` with the HMO-margin
  leg (Model A — record only); claims visibility up the chain (HMO adjudicates, insurer
  oversight); optional insurer sign-off threshold.

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
