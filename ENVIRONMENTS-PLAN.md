# MobiCova Health — Environments Plan (Dev · UAT · Prod)

> A clean three-environment model so changes flow safely from an engineer's laptop to
> live members: build in **Dev**, sign off in **UAT**, run in **Production**. This also
> answers two questions: how to stand up a low-cost **Development** environment, and how
> to convert today's **MVP** into the **UAT / pre-production** environment.
>
> Figures are planning-grade estimates in USD ranges.

---

## 1. Why three environments

| | **Development** | **UAT / pre-prod** | **Production** |
|--|----------------|--------------------|----------------|
| Purpose | build & integrate features | acceptance sign-off before release | serve real members |
| Audience | engineers only | internal team + named partner testers | the public / members |
| Data | synthetic, reset freely | synthetic, production-like | **real PII (NDPR-governed)** |
| Integrations | sandbox / mock | **test / sandbox keys** | live keys |
| High availability | none (can sleep) | none (single instance) | **multi-AZ, HA, PITR** |
| Deploy trigger | `feature/*` → preview | `main` → auto-deploy | release tag → manual approve |
| Region | anywhere (cheap) | EU/managed (as today) | **AWS af-south-1** |
| Indicative cost | **$0 – $50 / mo** | **$50 – $300 / mo** | $1.5k – $3k / mo (see production plan) |

**Golden rules:** three **isolated databases** (never shared); **only Production holds real
PII**; secrets are separate per environment; UAT mirrors prod *config* so "passes in UAT"
predicts "works in prod".

---

## 2. Development environment — design & cost

**Goal:** a fast, cheap place to build and test without touching UAT or prod. It does **not**
need to be highly available or production-sized.

### Recommended shape (lowest cost, good DX)
- **Local-first:** run the stack on the laptop (`npm run dev` for client + server, a local or
  free-tier Postgres). Fastest inner loop, zero cloud cost.
- **Shared previews:** use **Render PR preview deploys** so each pull request gets a
  temporary URL for review — included on Render's paid plans, torn down on merge.
- **Dev database:** a **free Supabase project** (separate from UAT/prod), seeded via the
  existing `seed.ts`. Reset any time.
- **Integrations:** everything in **sandbox/mock** — Stripe/Paystack test keys, the built-in
  USSD/WhatsApp **simulators**, Resend test domain, an Anthropic key with a **low budget cap**.
- **No HA, no on-call.** The service can sleep when idle.

### Options & cost

| Option | What | Monthly |
|--------|------|---------|
| A. Local + PR previews + free Supabase | daily dev on laptop, share via previews | **$0 – $15** |
| B. Always-on shared dev service | Render Starter (~$7) + free Supabase + test integrations | **$15 – $35** |
| C. Comfortable always-on dev | small Render + Supabase paid dev add-ons | **$35 – $50** |

**Recommendation:** start with **Option A/B (~$0–$35/mo)**. One-time setup is ~**1 day**
(env files, a `develop` branch + preview config, a dev Supabase project, seed/reset script).

---

## 3. Converting the MVP → UAT / pre-production

Good news: today's MVP (Render + Supabase live demo) is **already staging-grade**. We
*promote* it into the formal UAT environment rather than rebuild it.

### Conversion checklist
1. **Give it a UAT identity** — a clear subdomain (e.g. `uat.<yourdomain>`), a persistent
   on-screen **"UAT — test environment, not live"** banner, and `APP_ENV=uat`. Add
   `robots: noindex` so it never shows up in search.
2. **Decouple from prod** — when Production launches fresh on AWS af-south-1 with its own
   database, the **existing Supabase becomes UAT's database**. UAT and prod never share a DB.
3. **Scrub & reseed (NDPR)** — remove any real or identifiable records; reseed synthetic data
   via `seed.ts`. Keep the demo accounts (`pius@…`, `admin@axamansard.demo`, `clinic@…`,
   `pharmacy@…`). Ship a **one-command reset-to-seed** script for testers.
4. **Make integrations safe** — so UAT can never charge money or message real people:
   - Payments → Stripe/Paystack **test keys**
   - WhatsApp → test number / sandbox (or the built-in simulator)
   - Email → Resend **test domain** or a catch-all test inbox
   - SMS / USSD → the app's **simulator** endpoints or a sandbox shortcode
   - Anthropic → a **separate key with a low cap**
5. **Restrict access** — internal team + named partner testers only; optional basic-auth or
   IP allow-list on the marketing surface.
6. **Wire the CI/CD gate** — `main` **auto-deploys to UAT**; UAT runs the existing
   `smoke-test.ps1` + `e2e-live-test.ps1` suites; a **release tag** promotes to Production.
   UAT becomes the sign-off gate before anything reaches members.
7. **Keep config at parity with prod** — same migrations, same env-var names — but it can stay
   **small and cheap** (single instance, daily backup, no HA).

### UAT cost
Essentially **today's MVP run-rate: ~$50–$300/mo** (Render Standard + Supabase Pro + small
add-ons + light monitoring). **One-time conversion: ~1–3 days** (banner, env flag, data scrub,
sandbox keys, reset script, `main`→UAT auto-deploy). Low risk — mostly configuration.

---

## 4. Promotion flow

```
feature/*  ──▶  Development (preview URL, sandbox)
   │ merge
   ▼
  main     ──▶  UAT / pre-prod (auto-deploy, test keys, partner sign-off)
   │ tag vX.Y (manual approve)
   ▼
 release   ──▶  Production (AWS af-south-1, live keys, HA, real PII)
```

Each step is a **gate**: previews catch obvious breakage; UAT is where partners accept the
release; only a tagged, approved build reaches Production.

---

## 5. Cost & effort summary

| Environment | Monthly run-rate | One-time setup |
|-------------|------------------|----------------|
| Development | $0 – $50 | ~1 day |
| UAT (from MVP) | $50 – $300 | ~1 – 3 days |
| Production (Tier B) | $1.5k – $3k | $30k – $70k (see production plan) |

**Recommended sequence:**
1. **Formalise the MVP as UAT now** (banner, sandbox keys, reseed, restrict access, `main`→UAT
   auto-deploy) — cheap and fast, and immediately gives you a safe sign-off environment.
2. **Stand up a lightweight Dev** (local + PR previews + a free Supabase dev project).
3. **Provision Production fresh** on AWS af-south-1 during Phase 2 of the production plan, and
   promote releases UAT → Prod.
