# MobiCova Health — MVP Build Prompt

A single, self-contained brief describing how this MVP is put together — usable as a
prompt to (re)generate the platform with an AI coding agent, or as an architecture
onboarding doc. Written as an instruction to the builder.

---

## 0. Role & goal

You are a senior full-stack engineer. Build **MobiCova Health** — a B2B **digital-health
infrastructure** SaaS for Nigeria/Africa. Partner organisations (insurers, employers,
telcos) enrol their members; members reach **telemedicine, an AI health assistant, and
health-linked insurance** across **App, WhatsApp, and USSD**. Care is delivered through
licensed provider partners (clinics, pharmacies). The platform is multi-tenant, with a
central platform admin and isolated per-organisation admins.

Optimise for a **demo-ready, full-featured MVP**: graceful degradation everywhere (no
external key ⇒ feature logs/simulates instead of breaking), idempotent migrations, and
clean separation of concerns.

---

## 1. Tech stack

- **Client:** React 19 + Vite + TypeScript, React Router (data router), TanStack Query,
  Axios, hand-rolled CSS (no UI kit), Recharts for charts.
- **Server:** Node + Express + TypeScript, PostgreSQL (Supabase), `pg` driver, JWT auth,
  `express-validator`, `bcryptjs`, `tsx` for scripts.
- **AI:** Anthropic Claude (symptom triage / health assistant) via the Messages API,
  with a deterministic fallback engine when no API key is set.
- **Integrations (all optional, graceful):** Stripe + Paystack (billing), WhatsApp Cloud
  API (OTP/notifications), Supabase Storage (claim documents), Resend (transactional
  email), SAML SSO.
- **Hosting:** Render (separate client + API services); Postgres on Supabase (use the
  IPv4 connection pooler). Custom domain via CNAME.

---

## 2. Multi-tenancy — the unified organisation model (the core idea)

**Everything is an Organisation of a `type`.** One `organisations` table is the single
source of truth. Each org has a `type` and a derived `class`:

| Class | Types | Owns members? | Workspace |
|-------|-------|---------------|-----------|
| **demand** | `company`, `underwriter`, `telco`, `fintech`, `cooperative` | yes | members, enrolments, claims, analytics |
| **supply** | `clinic`, `pharmacy`, `diagnostics` | no | the queue routed to them + their staff |
| **integration** | `ehr`, `distribution` | no | (registry only) |
| **platform** | the MobiCova org itself | — | Admin Console |

- **Isolation is enforced by `org_id`-scoped queries everywhere** — every staff/member/
  provider record carries an org id; every query filters by it. There is no per-org URL
  or subdomain; tenancy is by login.
- **Demand orgs** own their members fully. **Supply orgs** serve members that belong to
  *other* orgs and may only read a **privacy "slice"** of those members (proven by a
  routing link): a clinic sees the consult + clinical context it created; a pharmacy sees
  name + medication + delivery address. Nothing more.
- Maintain a single `ORG_TYPE_META` constant (type → label, class) shared by client + server.

---

## 3. Three isolated auth domains

Implement three separate JWT auth domains; tokens of one are rejected on the others'
routes (distinct token keys + scope checks):

1. **Staff** (`users`): email + password, `org_id` + `role` (`admin`/`manager`/`analyst`)
   in the JWT, optional TOTP 2FA, `is_platform_admin` flag (or `PLATFORM_ADMIN_EMAILS`
   allowlist). Platform admins additionally see an **Admin Console** and land on it after
   login. Supply-org admins are ordinary staff users whose org is a clinic/pharmacy.
   Invited admins activate via an emailed **set-password token** (no plaintext passwords).
2. **Member** (`members`): passwordless **OTP** (phone/email → one-time code; delivered via
   WhatsApp when configured, otherwise returned on-screen in demo mode). `scope:'member'`.
3. **Provider** (`providers`): clinicians/pharmacists, email + password, `scope:'provider'`.
   Many-to-many with orgs (`provider_organisations`) so a doctor can span clinics, with a
   **clinic switcher** that re-scopes the portal (passes `?orgId=` on every request).

---

## 4. Core data model (key tables)

`organisations` (id, name, slug, **type**, country, plan_tier, join_code, is_active,
legacy_partner_id) · `users` (org_id, role, is_platform_admin, totp_*, activation_token_*)
· `members` (org_id, demographics, blood_group, allergies[], chronic_conditions[], channel)
· `partners` (legacy care-network registry; folded into organisations) · `providers`
(role doctor|pharmacist, partner_id nullable, org link via `provider_organisations`) ·
`insurance_plans` (underwriter_org_id) · `enrolments` · `consultations` (mode, channel,
status, provider_org_id) · `prescriptions` (medication, pharmacy_org_id, **fulfilment**:
method pickup|delivery, address, courier, tracking_ref, status timeline) · `claims`
(reference, state machine submitted→under_review→approved/rejected→paid, documents) ·
`triage_sessions` · `audit_log` (append-only) · `api_keys` + `webhooks` · `org_sso` ·
`org_branding` · `member_otps` · `demo_leads`.

Migrations are **numbered, idempotent SQL** (a `_migrations` table tracks applied ones),
run via `npm run migrate`. A `npm run seed` provisions demo orgs/admins/providers/members.

---

## 5. Feature set

**Member experience (App/WhatsApp/USSD):** OTP login; home dashboard (cover, recent care);
**telemedicine** video/voice calls (WebRTC self-view UI, logged as consultations); **AI
symptom check** (triage levels + recommendation); **prescriptions** with pickup/delivery
choice + live tracking timeline; **claims** submission; profile/health snapshot; a "talk
to a doctor" shortcut. WhatsApp + USSD intake via per-org **join codes**.

**Provider portal:** doctors get a consult queue (accept, notes, diagnosis, prescribe to a
pharmacy org); pharmacists get a dispensary that advances the fulfilment state machine
(pending → ready → out_for_delivery → delivered | collected) with courier + tracking; the
multi-clinic **switcher**.

**Partner (demand-org) dashboard:** members CRUD + bulk CSV import; telemedicine; insurance
plans & enrolments; claims adjudication; **analytics & reporting** (KPIs, utilisation,
trends, query builder); channels (WhatsApp/USSD simulators); inbox/action centre.

**Supply-org dashboard:** focused workspace (queue routed to them + staff management;
self-service add/deactivate clinicians); nav adapts by org class; member-care privacy slice.

**Platform Admin Console** (platform admins only): Organisations (all orgs, filter by type,
onboard new with first admin), Users, Partners, Insurance plans, Providers, Audit log, per-
org SSO config.

**SaaS layer:** onboarding checklist; ⌘K command palette; help widget; help/docs; billing &
subscription tiers (Stripe/Paystack, demo tier-switch); white-label branding (per-org colours/
logo/name); **per-org branded login** at `/o/<slug>/login`; public REST API + API keys +
webhooks; 2FA (TOTP) self-service; SAML SSO; a public **marketing/pricing site** at `/`.

**Onboarding emails (Resend):** welcome + set-password activation to new admins; access
instructions + join code to new members. Logs instead of sending when no key is set.

---

## 6. Branding & design

- Name: **MobiCova Health**. Wordmark logo (transparent PNG) shown across sidebar, auth
  heros, portals, and the marketing nav/footer via a reusable `BrandLogo` component
  (renders bare on dark chrome with a soft shadow; on a dark teal "chip" on light cards).
- Palette: teal `#0a7b7b` primary, deep teal `#0d2a2a` dark, orange `#e8912c`/amber accent.
- Favicon/app icons derived from the logo (white **M** + orange swoosh on a teal tile).
- Per-org **white-label branding** (display name, logo letter, primary/accent colours)
  applied to member surfaces and the branded login page.

---

## 7. Non-functional requirements

- **Graceful degradation**: Stripe/Paystack, WhatsApp, Anthropic, Supabase Storage, Resend,
  SSO are all optional — absent config ⇒ the feature simulates/logs, never errors.
- **Security**: bcrypt password hashing; JWT per domain; org-scoped queries; activation
  tokens (SHA-256 hashed) instead of emailed passwords; no demo creds on login pages;
  audit log; org suspension blocks login; capability gating by org class.
- **Idempotent, additive migrations**; deploy order matters (migrate before serving new code
  that reads new columns). Backwards-compatible reads (org routing OR legacy partner).
- **Verification**: server `tsc --noEmit` + client `vite build` green on every change; an
  API smoke-test script; a manual UAT test script (Parts A/B/C).

---

## 8. Recommended build sequence (how it was actually phased)

1. **Scaffold** + DB layer + core auth (staff) + dashboard.
2. **Members**, telemedicine, insurance, **triage (Claude)**, claims.
3. **Channels** (WhatsApp/USSD intake + join codes).
4. **Platform admin** (flag + Admin Console: orgs, users, partners, plans, audit).
5. **Q-features**: audit log, granular roles, SSO, bulk import, analytics, member OTP
   portal, public API + webhooks, provider portal.
6. **SaaS phases**: onboarding/palette/help → billing/branding → docs/API console/analytics
   builder/inbox → marketing site.
7. **Care chain**: add doctors (admin CRUD), pharmacies + prescription routing, prescription
   **fulfilment & tracking** (pickup/delivery, courier, member tracking).
8. **Unified org model** (the big refactor), in safe phases:
   - *Phase 0*: schema (rename `partner_type`→`type`, provider↔org M2M, org routing columns).
   - *Phase 1*: data migration (partners→orgs, dedupe insurers) + demo seed.
   - *Phase 2*: org-type metadata + switch prescription routing onto orgs + `orgClass` on session.
   - *Phase 3*: unified Admin Console (orgs by type, filter, onboarding).
   - *Phase 4*: supply-org dashboards + provider multi-org auth + clinic switcher + capability gating.
9. **Polish**: per-org branded login URLs, onboarding email automation, rebrand to MobiCova
   Health + favicon, platform-admin landing on the Admin Console.

Ship each phase independently, verifying builds and keeping live data safe (additive first,
flip reads second, drop legacy last).

---

## 9. Demo logins (seeded)

- Platform admin / underwriter org admin: `admin@axamansard.demo`
- Clinic admins: `clinic@mobicova.demo`, `clinic2@mobicova.demo` · Pharmacy admin: `pharmacy@mobicova.demo`
- Doctor (spans 2 clinics): `doctor@mobicova.demo` · Pharmacist: `pharmacist@mobicova.demo`
- Member (OTP): `amaka.obi@member.demo`
- Demo password via `DEMO_SEED_PASSWORD` (never commit the real one).

Three login surfaces, one domain: `/login` (staff + platform admin), `/provider/login`,
`/member/login`. Per-org branded entry at `/o/<slug>/login`.
