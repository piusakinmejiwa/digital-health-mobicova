# MobiCova — Unified Organisation Model (Hybrid) — Implementation Plan

**Status:** In progress — Phase 0 complete (builds green); Phase 1 next
**Date:** 2026-06-06
**Decision taken:** Hybrid model (unified `organisations` table, per-org admins, supply-side orgs see only the work routed to them)

---

## 0. Decisions locked (from review)

| # | Question | Decision |
|---|----------|----------|
| 1 | Merge the AXA Mansard partner-vs-org duplication | **Yes** — one org row per underwriter |
| 2 | Diagnostics / EHR / Distribution | **Model as org types now** (`diagnostics`, `ehr`, `distribution`) |
| 3 | Telcos | **Own members** (demand-side), not just distribute sign-ups |
| 4 | Auth | **Keep both** logins (org-admin via `users`, clinician via `providers`) |
| 5 | Type column | **Rename `partner_type` → `type`** (done in Phase 0) |
| 6 | One doctor → many clinics | **Yes** — provider↔org is many-to-many (`provider_organisations`) |
| 7 | One pharmacy → many members | **Yes** — inherent to supply model; no schema change needed |
| 8 | Seed/demo | **Add a demo clinic + pharmacy org, each with its own admin** (Phase 1) |

**Canonical org types:** `company`, `underwriter`, `telco`, `fintech`, `cooperative` (demand) · `clinic`, `pharmacy`, `diagnostics` (supply) · `ehr`, `distribution` (integration).
**Class** is derived in code from type (no DB column yet): demand / supply / integration / platform.

### Phase 0 — DONE (structural, additive; builds green)

- Migration **026** — renamed `organisations.partner_type` → `type`; added `organisations.legacy_partner_id` (provenance for the partners→orgs migration).
- Migration **027** — `provider_organisations` M2M link table (provider_id, org_id, is_primary).
- Migration **028** — routing columns: `consultations.provider_org_id`, `prescriptions.pharmacy_org_id`, `insurance_plans.underwriter_org_id`.
- **Rename code sweep:** admin Org API + Admin Console now speak `type` (org-type dropdown extended to all 10 types); `auth`/member APIs keep their existing field names mapped from `type` via SQL alias (no churn into those contexts). `demo_leads.partner_type` left untouched (different concept).
- Migration **must be run by you** (`npm run migrate`) — code is shipped but the live DB still has the old column until then. Note: code now writes the `type` column, so **migrate before deploying** the new server, or logins/org reads will error on the missing column.

### Phase 1 — DONE (data migration + demo seed; server typechecks green)

- **`server/src/db/migrateOrgModel.ts`** + npm script **`npm run migrate:org-model`** — idempotent one-off backfill:
  - normalises legacy type values (`employer`→`company`, `insurer`→`underwriter`);
  - creates one org per partner, deduping insurers onto the existing underwriter org (no duplicate AXA Mansard);
  - links providers→orgs (many-to-many);
  - backfills `consultations.provider_org_id`, `prescriptions.pharmacy_org_id`, `insurance_plans.underwriter_org_id`.
- **Seed** (`npm run seed`) now provisions a demo **clinic org** (Helium Health, admin `clinic@mobicova.demo`) and **pharmacy org** (HealthPlus, admin `pharmacy@mobicova.demo`), links the demo doctor/pharmacist to them, and routes the seeded queue rows. Both orgs carry `legacy_partner_id` so the data migration treats them as already-migrated.
- **Run order (after deploying this):** `npm run migrate` (already done) → `npm run migrate:org-model` → optionally `npm run seed` for the demo orgs/admins.

> Note: Phase 1 backfills data but does **not** change any read paths yet — the app still reads via the legacy partner columns, so nothing breaks. Switching reads to the org columns + the privacy slice is **Phase 2**.

---

## 1. Goal

Make **every** business on the platform a first-class **Organisation** of a given **type** — Underwriter, Company, Telco, Clinic (Doctors), Pharmacy — so that:

1. **Platform Administration** (MobiCova staff) sees and manages *all* organisations from one place.
2. **Each organisation is managed individually**, with its own admin(s).
3. **Org admins see only their own organisation** — no visibility into others.
4. Care still flows naturally **across** orgs (a member of one org is treated by a doctor in another and gets medicine from a pharmacy in a third), with each org seeing only its **slice**.

This is the **Hybrid** model: the unified Organisations experience you asked for, made realistic about the fact that care delivery crosses org boundaries.

---

## 2. Where we are today (baseline)

| Concept | Table | Today's role |
|---------|-------|--------------|
| Tenant (paying customer) | `organisations` | Underwriters, companies, telcos. Has `partner_type` (employer/insurer/telco/fintech/cooperative), `is_active`, branding, SSO, billing. |
| Staff user | `users` | Belongs to one org (`org_id`), role admin/manager/analyst, `is_platform_admin` flag. **Every query is filtered by `org_id`** → real isolation already works. |
| Member | `members` | Belongs to one org (`org_id`). |
| Care network (company) | `partners` | Shared, platform-wide. `category` = telemedicine / pharmacy / insurer / diagnostics / ehr / distribution. **Not** a tenant, **not** isolated. |
| Clinician / pharmacist | `providers` | Belongs to a `partner` (`partner_id`), role doctor/pharmacist, own login (Provider Portal). |
| Routing | `consultations.partner_id`, `prescriptions.pharmacy_partner_id` | Consults/prescriptions routed to a **partner**. |

**The gap:** Doctors and Pharmacies live in the `partners`/`providers` world, *not* as Organisations. They have no per-org admin and no isolation in the org sense.

**A duplication to resolve:** insurers exist **twice** —
- `partners`: `AXA Mansard` (category `insurer`)
- `organisations`: `AXA Mansard Health` (partner_type `insurer`)
- `insurance_plans.underwriter` references the underwriter by **name string** (`'AXA Mansard'`).

The plan converges these onto a single Organisation row per real-world entity.

---

## 3. Target model

### 3.1 One organisation, with a `type` and a `class`

`organisations` becomes the single source of truth for "a business on the platform."

- **`type`** — the org's kind. Canonical value set:
  - `underwriter` (was `insurer`)
  - `company` (was `employer`)
  - `telco`
  - `clinic` (doctors / telemedicine group) — **new**
  - `pharmacy` — **new**
  - `diagnostics` — **new, optional/phase-later**
  - (retain `fintech`, `cooperative` as company-like demand orgs, or fold into `company`)
- **`class`** — derived from `type`, defines the isolation flavour:
  - `demand` → owns members (underwriter, company, telco, fintech, cooperative)
  - `supply` → delivers care to other orgs' members (clinic, pharmacy, diagnostics)
  - `platform` → MobiCova itself (optional, for platform-admin home org)

> **Implementation choice (low-risk):** keep the existing column name `partner_type` as the `type` field (broaden its allowed values) to avoid a churny rename across the codebase. Document the canonical value list. A cosmetic rename to `type` can be a later, separate migration. `class` is derived in code from a single `ORG_TYPE_META` constant (source of truth), with an optional denormalised `org_class` column if we want DB-level filtering.

### 3.2 Who administers a supply-side org

A supply org (e.g. HealthPlus) reuses the **existing** machinery:

- **`users`** (org_id → the pharmacy org, role `admin`/`manager`/`analyst`) = the org's **admin accounts**. They get the same scoped dashboard + isolation that already works today. *Nothing new to build for isolation.*
- **`providers`** (re-linked to the org, see 3.3) = the **operational clinical logins** (the pharmacist who dispenses, the doctor who consults) via the Provider Portal.

So a pharmacy org has admins (manage staff/profile/queues) **and** pharmacists (do the dispensing). A clinic org has admins **and** doctors.

### 3.3 Re-link providers to organisations

- Add `providers.org_id` (FK → organisations).
- Each existing provider's `org_id` is set to the org created from its current `partner`.
- `partner_id` retained during transition, dropped in a later phase.
- Provider JWT carries `org_id` (+ existing `scope:'provider'`).

### 3.4 Org-based routing

Introduce org-based routing columns alongside the existing partner-based ones (backfill, switch reads, drop old later):

- `consultations.provider_org_id` (the clinic org) — set on creation from the doctor's org.
- `prescriptions.pharmacy_org_id` (the pharmacy org) — replaces `pharmacy_partner_id` over time. The doctor's "send to pharmacy" dropdown lists **pharmacy-type orgs**; the pharmacist dispensary filters by **their own** `org_id`.

---

## 4. The privacy "slice" (the heart of Hybrid)

A supply-side org must only ever read the **minimum** about a member it is actively serving, proven by a routing link. This is implemented as a single, tested **member-care projection** — not ad-hoc WHERE clauses.

**Clinic (for a consult routed to one of its doctors) may see:**
- Member name, age/gender
- The consult it owns: reason, notes, diagnosis it recorded
- Clinically necessary context: allergies, chronic conditions, current medications, blood group
- **Not:** claims, plan/enrolment, billing, contact details beyond what's needed, consults with *other* clinics, the member's full org record.

**Pharmacy (for a prescription routed to it) may see:**
- Member name
- The prescription: medication, dosage, instructions
- Fulfilment: method, delivery address, a contact phone for delivery
- **Not:** full health profile, claims, plan, unrelated prescriptions.

**Enforcement pattern:** every supply-side read joins **through the routing link** (`provider_org_id` / `pharmacy_org_id`) to prove the relationship, then selects only the allowed columns via the projection helper. A supply org with no link to a member can retrieve nothing about them.

**Demand-side orgs** keep today's behaviour: full ownership of their own members, zero visibility of other orgs.

---

## 5. Auth, middleware & capabilities

- **Staff auth (`users`)** — unchanged mechanics; already carries `org_id` + `role`. Works for supply-org admins as-is.
- **Org-type capability map** — a new middleware/helper asserting which endpoints apply to which org class. E.g. `/members`, `/claims`, `/enrolments` → **demand-only**; `/dispensary` → **pharmacy-only**; `/consult-queue` → **clinic-only**. Prevents a pharmacy admin from hitting member-management routes even if they guess the URL.
- **Platform admin** — unchanged; full cross-org access via `/admin/*`.
- **Nav adapts by org type** — the dashboard shows the relevant sections per class (a pharmacy admin sees Dispensary / Staff / Profile; a company admin sees Members / Enrolments / Claims / Analytics).

---

## 6. Admin Console (platform) changes

- **Organisations tab** — add a **Type** column + filter; the create-org form picks any type. Creating a **supply** org can optionally create its **first admin user** and **first provider** in the same flow.
- **Partners tab** — reframed. For clinic/pharmacy, superseded by Organisations. Remaining categories (diagnostics/ehr/distribution) either become org types later or stay as a lightweight "integrations" registry. Decision in §10.
- **Providers tab** — provider now belongs to an **org**; the old "partner" dropdown becomes an **org dropdown filtered to clinic/pharmacy**. Provider management can also live inside the org's detail view.
- **Insurers dedupe** — merge each `insurer` partner into its matching `underwriter` org; migrate `insurance_plans.underwriter` (name string) to reference the org (by id, with name kept for display).
- **Audit log** — unchanged (cross-org).

---

## 7. Per-org dashboards

- **Demand orgs** (underwriter/company/telco) — existing dashboard unchanged (members, enrolments, claims, analytics, billing, branding, SSO).
- **Supply orgs** — tailored, reusing Provider Portal components:
  - **Pharmacy:** Dispensary queue (already built), Staff (pharmacists), Profile/branding, basic analytics (volumes, turnaround).
  - **Clinic:** Consult queue (already built), Doctors, Profile/branding, basic analytics (consults, ratings).

---

## 8. Schema changes (new migrations, all idempotent & non-breaking first)

| # | Migration | Change |
|---|-----------|--------|
| 026 | `broaden_org_type` | Document/allow new `partner_type` values; optional `org_class` column backfilled from type. |
| 027 | `providers_org_link` | `providers.org_id` (FK, nullable) + index. |
| 028 | `routing_org_columns` | `consultations.provider_org_id`, `prescriptions.pharmacy_org_id` (+ indexes). |
| 029 | `insurance_underwriter_org` | `insurance_plans.underwriter_org_id` (FK, nullable). |

All additive and nullable so existing prod data and code keep working until reads are switched.

---

## 9. Data migration (one-off, idempotent script run after 026–029)

1. For each `partner` with category `telemedicine` → create/match an org of type `clinic`.
2. For each `partner` with category `pharmacy` → create/match an org of type `pharmacy`.
3. For each `partner` with category `insurer` → match to the existing `underwriter` org (e.g. "AXA Mansard" partner → "AXA Mansard Health" org); do **not** create a duplicate.
4. Set `providers.org_id` from each provider's `partner` mapping.
5. Backfill `consultations.provider_org_id` from `provider_id → org_id`.
6. Backfill `prescriptions.pharmacy_org_id` from `pharmacy_partner_id → org_id` (with name fallback, mirroring today's RX_MATCH).
7. Backfill `insurance_plans.underwriter_org_id` from the underwriter name string.
8. Verify counts; log anything unmatched for manual review (no silent drops).

---

## 10. Open questions for you

1. **Diagnostics / EHR / Distribution partners** — make `diagnostics` an org type now, later, or leave these as a lightweight integrations registry? (Your five named types are underwriter/company/telco/clinic/pharmacy.)
2. **Telcos** — confirm they *own* members (demand) as today, vs. only distributing sign-ups.
3. **One doctor, multiple clinics?** — assume one org per provider for now (simplest); revisit if needed.
4. **Auth unification** — keep the two staff logins (org admin via `users`, clinician via `providers`) for now, or converge to one later? (Plan keeps both.)
5. **Type rename** — keep column `partner_type` (low risk) or rename to `type` now (cleaner, churnier)?
6. **Seed/demo data** — update the seed so demo shows a clinic org + pharmacy org with their own admins? (Recommended for demos.)

---

## 11. Phased rollout (each phase ends green + a manual checkpoint)

- **Phase 0 — Schema (026–029).** Additive, nullable. No behaviour change. *Checkpoint: migrate + builds green.*
- **Phase 1 — Data migration.** Create clinic/pharmacy orgs, link providers, backfill routing + underwriter. *Checkpoint: spot-check mappings; nothing unmatched.*
- **Phase 2 — Server reads + privacy slice.** Switch routing reads to org columns; add the member-care projection; add org-type capability middleware. *Checkpoint: existing flows still work; isolation verified.*
- **Phase 3 — Admin Console.** Unified Organisations (type filter, supply-org creation incl. first admin/provider); insurer dedupe; provider→org dropdown. *Checkpoint: create a pharmacy org end-to-end as platform admin.*
- **Phase 4 — Supply-org dashboards.** Clinic/pharmacy admin views (queues, staff, profile), nav adapts by type. *Checkpoint: log in as a pharmacy admin, manage staff, see only routed work.*
- **Phase 5 — Cleanup.** Deprecate redundant partner usage; later drop `partner_id`/`pharmacy_partner_id` once reads fully migrated. *Checkpoint: no references remain.*

Each phase is independently shippable and reversible; nothing breaks live data because Phases 0–1 are purely additive.

---

## 12. What does NOT change

- The entire demand-side experience (underwriters/companies/telcos) and its already-working isolation.
- Member app, OTP auth, claims, triage, telemedicine calls, the prescription fulfilment/tracking just built.
- Platform-admin bypass model.
- These get *extended*, not rewritten.

---

## 13. Rough effort

- Phases 0–2 (foundation + isolation): the bulk of the backend work.
- Phases 3–4 (admin + supply dashboards): the bulk of the frontend work; large reuse of existing components.
- Phase 5: small, later.

Recommend doing **Phase 0 + 1 together first** (safe, reversible, unlocks everything) and reviewing before Phase 2.
