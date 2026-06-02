# MobiCova Digital Health — MVP

B2B digital health platform for the Nigerian market. Partner organisations (employers,
insurers, telcos) log in to manage their members and three integrated Tier 1 services:

- **Telemedicine** — book and manage consultations with licensed-provider partners, with
  e-prescriptions fulfilled by pharmacy partners.
- **AI Health Assistant** — symptom triage and health guidance (Claude API, with a
  rule-based fallback when no API key is configured).
- **Health-linked Insurance** — plan catalog, member enrolment, and premium checkout
  (Paystack — NGN-native — or Stripe).

Members don't need the dashboard or an app: partners enrol them over **WhatsApp** or **USSD**
from a basic phone, attributed to the partner via a 6-digit organisation **join code**. Both
channels funnel into the same member records. See [WhatsApp & USSD intake](#whatsapp--ussd-intake).

MobiCova's positioning is **Health Platform + Distributor + Infrastructure Provider** — it
connects people to clinical services, it does not provide them. This MVP reflects that:
every clinical service is delivered through a partner; MobiCova owns the member relationship,
the health-data layer, and the distribution channel.

## Stack

- **Client** — React 19 + Vite + TypeScript, React Router, TanStack Query, Axios
- **Server** — Express + TypeScript, PostgreSQL (Neon or Supabase), JWT auth
- **AI** — Anthropic Claude API (`@anthropic-ai/sdk`) with prompt caching
- **Payments** — Paystack (NGN-native) or Stripe Checkout (insurance premiums)
- **Channels** — WhatsApp Business Cloud API (Meta) + USSD (Africa's Talking) member intake

## Getting started

### 1. Server

```bash
cd server
npm install
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, (optional) ANTHROPIC_API_KEY, STRIPE_SECRET_KEY
npm run migrate           # create tables
npm run seed              # load partner ecosystem + insurance plans + a demo org
npm run dev               # http://localhost:4000
```

### 2. Client

```bash
cd client
npm install
npm run dev               # http://localhost:5173
```

### Demo login (after seeding)

- **Email:** `admin@axamansard.demo`
- **Password:** `password123`

## Environment

| Var | Required | Purpose |
|-----|----------|---------|
| `DATABASE_URL` | yes | Postgres / Neon connection string |
| `JWT_SECRET` | yes | Token signing secret |
| `ANTHROPIC_API_KEY` | no | Enables the live Claude triage assistant (falls back to rules if absent) |
| `ANTHROPIC_MODEL` | no | Overrides the triage model, defaults to `claude-sonnet-4-5` |
| `PAYSTACK_SECRET_KEY` | no | Enables Paystack premium checkout (NGN-native; preferred over Stripe when set) (`sk_…`) |
| `STRIPE_SECRET_KEY` | no | Enables Stripe premium checkout fallback (enrolment still works without it) |
| `STRIPE_WEBHOOK_SECRET` | no | Verifies Stripe webhook calls so paid premiums are confirmed (`whsec_…`) |
| `WHATSAPP_VERIFY_TOKEN` | no | Token Meta echoes back when verifying the WhatsApp webhook |
| `WHATSAPP_TOKEN` | no | Meta Cloud API access token — enables live WhatsApp replies |
| `WHATSAPP_PHONE_ID` | no | Meta WhatsApp phone-number ID used to send replies |
| `PLATFORM_ADMIN_EMAILS` | no | Comma-separated emails granted access to the Admin Console (organisations, users, plans, partners) |
| `CLIENT_URL` | no | CORS origin, defaults to `http://localhost:5173` |
| `PORT` | no | API port, defaults to `4000` |

The **client** has one env var (set it in `client/.env`, or in the host's dashboard):

| Var | Required | Purpose |
|-----|----------|---------|
| `VITE_API_URL` | no | Base URL of the API, e.g. `https://mobicova-api.onrender.com/api/v1`. Falls back to `http://localhost:4000/api/v1` when unset. Baked in at **build** time. |

This is an MVP: clinical providers, insurers, and pharmacies are represented as partner
records and mock integrations. No real PHI should be entered.

## Admin Console

**Platform admins** manage tenants, users, and the platform-wide catalog in-app from the
**Admin Console** page (visible in the sidebar only to platform admins). Four tabs:

- **Organisations** — onboard a partner tenant and, optionally, its first admin user in one
  step (the live-demo onboarding flow). Slug and 6-digit join code are generated automatically.
  Edit details, **suspend** (soft — blocks all the tenant's logins without deleting data) or
  reactivate, and hard-delete (blocked once the org has members — suspend instead). You can't
  suspend or delete your own organisation. Migration `010_add_org_active.sql` adds the
  `is_active` flag that login is gated on.
- **Users** — create dashboard users under any organisation, edit name/role, toggle
  platform-admin access, reset passwords, deactivate, or delete. Self-lockout is guarded: you
  can't deactivate, delete, or remove platform-admin from your own account.
- **Insurance plans** — create, edit, deactivate (soft, keeps existing enrolments intact), or
  hard-delete (blocked when a plan is referenced by an enrolment).
- **Partners** — full CRUD across every category (telemedicine, insurer, pharmacy, diagnostics,
  EHR, distribution), with activate/deactivate and delete.
- **Audit log** — an append-only, read-only trail of every privileged action (org/user/plan/
  partner create, update, suspend, delete, password reset), with the actor, target, tenant, and
  timestamp. Migration `011_create_audit_log.sql` adds the `audit_log` table; writes are
  best-effort so auditing can never break the action it records.

Insurance plans and the partner ecosystem are **platform-wide** (shared across every
organisation); organisations and users are the per-tenant records.

**Who is a platform admin?** A user whose `users.is_platform_admin` flag is set, *or* whose email
is listed in `PLATFORM_ADMIN_EMAILS`. The env allowlist is a zero-DB way to grant yourself access:
set `PLATFORM_ADMIN_EMAILS=you@example.com` and re-deploy. The seeded demo admin
(`admin@axamansard.demo`) is elevated automatically by `npm run seed`. Access is enforced
server-side (all `/admin/*` routes sit behind a platform-admin guard) — the hidden sidebar item is
just a convenience. Migration `009_add_platform_admin.sql` adds the flag column.

## WhatsApp & USSD intake

Partners enrol members without the dashboard — from a feature phone (USSD) or a chat
(WhatsApp). A short conversation collects the organisation join code, the member's name, and
gender, then writes a member record attributed to that organisation.

- **Join code** — every organisation gets a 6-digit `join_code` (shown on the *WhatsApp & USSD*
  page and returned by `/auth/me`). Members type it as the first step so the enrolment is
  attributed to the right partner. Migration `008_create_channel_intake.sql` adds the column,
  backfills existing orgs, and creates the `intake_sessions` table.
- **USSD** is stateless — the aggregator replays the full `*`-joined input on each request, so the
  engine re-derives state every call. Replies are prefixed `CON ` (expect more input) or `END `
  (session over).
- **WhatsApp** is stateful — each sender's progress is persisted in `intake_sessions` between
  messages.

### Try it without any telco/Meta account

The *WhatsApp & USSD* page in the dashboard ships **in-app simulators** (a feature-phone screen and
a chat transcript) that hit the exact same endpoints a live provider would. No external account
needed to demo the full flow end to end.

### Go live

Point a real provider at these endpoints — no code change needed:

| Channel | Endpoint | Method |
|---------|----------|--------|
| USSD (e.g. Africa's Talking) | `<API>/channels/ussd` | `POST` |
| WhatsApp (Meta Cloud API) | `<API>/channels/whatsapp/webhook` | `GET` (verify) + `POST` (messages) |

USSD needs only a shortcode lease with your aggregator. Live WhatsApp replies require
`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN`, and `WHATSAPP_PHONE_ID` set on the API; without them the
webhook still accepts and processes messages (and the simulators work), it just won't push replies
back through Meta.

## Deployment (Render)

The repo includes a `render.yaml` blueprint that defines both services (the Express API as a
Web Service, the Vite client as a Static Site). The database stays on Supabase/Neon.

### First deploy

1. **Push to GitHub** — Render deploys from Git:
   ```bash
   git init && git add -A && git commit -m "MobiCova MVP"
   gh repo create mobicova-platform --private --source=. --push
   ```
   `.env` files are gitignored, so secrets stay local — only `.env.example` templates are committed.
2. **Create a free Render account** at <https://render.com> (sign in with GitHub).
3. **New + → Blueprint** → pick the repo → Render reads `render.yaml` and proposes
   `mobicova-api` + `mobicova-client` → **Apply**.
4. **Set the blank secrets** in each service's Environment tab:
   - `mobicova-api`: `DATABASE_URL` (the Supabase **pooler** string, see note below),
     `CLIENT_URL` = the client's URL, optional `ANTHROPIC_API_KEY` / `STRIPE_SECRET_KEY`.
     `JWT_SECRET` is auto-generated.
   - `mobicova-client`: `VITE_API_URL` = the API's URL + `/api/v1`.
5. **Cross-wire + redeploy the client** — the two URLs reference each other; after the first
   deploy, confirm the real URLs Render assigned, fix the two values if a name suffix was added,
   then redeploy the client (Vite bakes `VITE_API_URL` in at build time).

The shareable link is the **client** URL (e.g. `https://mobicova-client.onrender.com`).

### Updating a live site

Auto-deploy is on by default — push to the connected branch and Render rebuilds the affected
service automatically:

```bash
git add -A
git commit -m "describe the change"
git push
```

- **Env-var changes** don't come from a push — edit them in the Render dashboard, then trigger a
  manual deploy (especially for the client, since `VITE_API_URL` is build-time).
- **New DB migrations** don't run automatically — run `npm run migrate` against the database when
  you add one.
- **Free-tier note:** the API sleeps after ~15 min idle, so the first request after a lull takes
  ~30s to wake.

### Supabase connection note

Supabase **direct** connections (`db.<ref>.supabase.co:5432`) are IPv6-only and may be
unreachable from some networks. Use the free **connection pooler** (IPv4) instead — no paid
add-on needed:

```
postgresql://postgres.<project-ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres
```

The username is `postgres.<project-ref>` (not plain `postgres`), and newer projects use the
`aws-1-` host prefix.
