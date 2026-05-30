# MobiCova Digital Health — MVP

B2B digital health platform for the Nigerian market. Partner organisations (employers,
insurers, telcos) log in to manage their members and three integrated Tier 1 services:

- **Telemedicine** — book and manage consultations with licensed-provider partners, with
  e-prescriptions fulfilled by pharmacy partners.
- **AI Health Assistant** — symptom triage and health guidance (Claude API, with a
  rule-based fallback when no API key is configured).
- **Health-linked Insurance** — plan catalog, member enrolment, and premium checkout (Stripe).

MobiCova's positioning is **Health Platform + Distributor + Infrastructure Provider** — it
connects people to clinical services, it does not provide them. This MVP reflects that:
every clinical service is delivered through a partner; MobiCova owns the member relationship,
the health-data layer, and the distribution channel.

## Stack

- **Client** — React 19 + Vite + TypeScript, React Router, TanStack Query, Axios
- **Server** — Express + TypeScript, PostgreSQL (Neon or Supabase), JWT auth
- **AI** — Anthropic Claude API (`@anthropic-ai/sdk`) with prompt caching
- **Payments** — Stripe Checkout (insurance premiums)

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
| `STRIPE_SECRET_KEY` | no | Enables Stripe premium checkout (enrolment still works without it) |
| `CLIENT_URL` | no | CORS origin, defaults to `http://localhost:5173` |
| `PORT` | no | API port, defaults to `4000` |

The **client** has one env var (set it in `client/.env`, or in the host's dashboard):

| Var | Required | Purpose |
|-----|----------|---------|
| `VITE_API_URL` | no | Base URL of the API, e.g. `https://mobicova-api.onrender.com/api/v1`. Falls back to `http://localhost:4000/api/v1` when unset. Baked in at **build** time. |

This is an MVP: clinical providers, insurers, and pharmacies are represented as partner
records and mock integrations. No real PHI should be entered.

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
