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
- **Server** — Express + TypeScript, PostgreSQL (Neon), JWT auth
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

This is an MVP: clinical providers, insurers, and pharmacies are represented as partner
records and mock integrations. No real PHI should be entered.
