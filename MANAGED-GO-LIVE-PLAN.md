# MobiCova Health — Managed Production Go-Live Plan (Path A)

> Launch production on the **hardened managed stack you already operate** — Render +
> Supabase + Cloudflare — as the fastest, lowest-ops route to live. This is the **bridge**
> to AWS af-south-1 (**Path C**, `infra/terraform/` + `PRODUCTION-DEPLOYMENT-RUNBOOK.md`),
> which your incoming **DevOps engineer** will execute later.
>
> Figures are planning-grade. Target: a careful go-live in **~3–5 days**.

---

## The plan in one line
Go live on managed now → hand the AWS af-south-1 migration to the DevOps engineer when
residency / SOC 2 / scale demand it. Nothing we build here is wasted: it's the same app,
same CI promotion model, same domains.

### Residency note (interim)
The managed stack runs in the **EU** (Frankfurt) with a Cloudflare **Lagos edge** for fast
African delivery. That's **NDPR-workable as an interim**; true af-south-1 residency arrives
with Path C. Flag this to enterprise insurer prospects as "on the roadmap".

### Environment model (now three live tiers)
```
Dev (local + previews)  →  UAT (managed, today's MVP)  →  Production (managed → AWS later)
   feature/*                    push to main                    release tag vX.Y
```

---

## Target managed-production architecture
- **Cloudflare** — DNS, CDN, **WAF**, DDoS, TLS/HSTS, rate-limiting (Lagos edge).
- **Render** — API on `render.prod.yaml`: **≥2 instances + autoscale**, `/health`, preDeploy migrate.
- **Supabase (separate prod project)** — HA Postgres + **PITR** + daily backups + (optional) read replica.
- **Sentry + Better Stack** — error tracking, uptime, alerting, on-call paging.
- **Live integrations** — Stripe/Paystack live, WhatsApp production, Resend verified domain, Anthropic prod.

---

## Phase 0 — Prerequisites & decisions
- Register/confirm the domain; plan `app.<domain>` (client) and `api.<domain>` (API).
- A **Cloudflare** account for the domain.
- **Live keys** ready (Stripe/Paystack live, WhatsApp prod number, Resend verified domain, Anthropic prod) — kept out of the repo.
- A **separate production Supabase project** (never share the UAT DB).
- Billing + spend alerts on Render and Supabase.

**✓** Domain, Cloudflare, prod Supabase project, and live keys all in hand.

## Phase 1 — Production database (Supabase)
1. New Supabase project, EU region, **Pro/Team** plan.
2. Enable **Point-in-Time Recovery** + daily automated backups; (optional) a **read replica** for reporting.
3. Use the **IPv4 connection pooler** string for `DATABASE_URL` — the direct host is IPv6-only and will time out.
4. Run migrations against the prod DB (`npm run migrate`, or the release pipeline's preDeploy).

**✓** Prod DB reachable via pooler; migrations applied; PITR on; a test restore validated.

## Phase 2 — Render production services
Create the two services from **`render.prod.yaml`** (`mobicova-prod-api`, `mobicova-prod-web`):
- API: **Standard plan, min 2 / max 4 instances**, autoscale on CPU, `preDeployCommand: npm run migrate`, `/health` check, `APP_ENV=production`, `autoDeploy: off`.
- Web: static, `VITE_API_URL=https://api.<domain>`.

**✓** Both services build green; API `/health` returns 200 across ≥2 instances.

## Phase 3 — Edge: Cloudflare
1. **DNS:** `app.<domain>` → Render web; `api.<domain>` → Render API (proxied/orange-cloud).
2. **WAF** managed ruleset + bot mitigation; **rate limiting**; **DDoS** on.
3. **TLS** Full (strict) + **HSTS**; security headers; cache the static client at the edge.

**✓** Site loads over HTTPS via Cloudflare; WAF blocks a test injection; headers grade A.

## Phase 4 — Secrets & live integrations
Set every `sync: false` var in the Render dashboard to a **live** value:
`DATABASE_URL` (pooler), `DATABASE_CA_CERT`, `JWT_SECRET` (auto), `CLIENT_URL`/`SERVER_URL`,
`PLATFORM_ADMIN_EMAILS`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`,
`PAYSTACK_SECRET_KEY`, `RESEND_API_KEY` + `EMAIL_FROM`, `WHATSAPP_*` (production number).

⛔ **Never set** `OTP_DEV_MODE` or `DEMO_SEED_PASSWORD` in production.
🔁 Turn on **MFA** for Render, Supabase, Cloudflare and GitHub accounts.

**✓** App boots with all live secrets; no secret in logs or repo.

## Phase 5 — Observability & on-call (do this even solo)
- **Sentry** on client + server (release tagging).
- **Better Stack** uptime check on `/health` **and** a login flow, from multiple regions.
- **Paging** to your phone/email on downtime or error spikes.
- A simple dashboard: request rate, error rate, latency, DB health.

**✓** An injected error pages you within minutes; uptime monitor is green.

## Phase 6 — CI/CD promotion
Already wired:
- **UAT** = auto-deploy from `main` (`uat.yml`).
- **Production** = tag `vX.Y` → `release.yml` → **manual approval** (GitHub `production` environment) → Render deploy hooks → smoke test.

Set up: the `production` environment with **required reviewers**, the two prod deploy-hook secrets (`RENDER_DEPLOY_HOOK_PROD_API/_WEB`), and `PROD_API_URL`.

**✓** Tagging a release prompts for approval, deploys, and smoke-tests green.

## Phase 7 — Go-live cutover
1. Final migration applied; **seed only real platform admin(s)** — no demo data.
2. Point **live webhooks** at prod `api.<domain>`: WhatsApp (Meta), Africa's Talking (USSD/SMS), Stripe/Paystack.
3. One **test payment** + refund; confirm webhook receipt.
4. **DNS cutover** (lower TTL beforehand).
5. **Smoke test** every channel: web, WhatsApp, USSD → enrolment + membership ID, OTP login, a claim.
6. Watch dashboards for the first hours; **rollback ready** (re-deploy the previous release).

**✓** Real enrolment works on each channel; payments + OTP live; error rate flat.

## Phase 8 — Post-launch
- Verify backups; run a **PITR restore test** to a Supabase branch/clone.
- First-week **cost + error review**.
- Write a **1-page incident runbook** (symptoms → who → restore steps).

---

## Solo-operator guardrails (until the DevOps engineer arrives)
- **Lean on managed auto-everything** — Supabase backups/PITR/failover, Render health-restart + autoscale. Let the platform do the ops.
- **Get one paid security review** before or right after go-live — highest-value single thing you can do for a health platform. (Don't skip this.)
- **Shrink the blast radius** — least-privilege/scoped keys, prod secrets separate from UAT, MFA everywhere.
- **Know before users do** — uptime monitor + paging is non-negotiable, even for one person.
- **Keep the incident runbook to one page** so a 3am you (or a contractor) can follow it.

## DevOps engineer handover pack (when they start)
Point them at, in the repo:
- **`MANAGED-GO-LIVE-PLAN.md`** (this) — how production runs today.
- **`PRODUCTION-DEPLOYMENT-RUNBOOK.md`** + **`infra/terraform/`** — Path C (AWS af-south-1) target.
- **`PHASE-1-RELIABILITY-SPEC.md`**, **`ENVIRONMENTS-PLAN.md`**, **`PRODUCTION-READINESS-PLAN.md`**.
- **`.github/workflows/production.yml`** — the AWS pipeline, currently manual; they flip its trigger to release tags at migration time and retire the managed deploy.

Their first two mandates: **(1)** a security review of managed production; **(2)** plan/execute the **Path C migration** to AWS af-south-1 when residency / SOC 2 / scale require it.

---

## Cost & timeline
- **Run-rate:** ~$1.2k–$2.5k/mo (managed Tier A) + variable comms (see the comms cost model).
- **Setup:** ~**3–5 days** for a careful go-live.
- **Later (Path C):** AWS af-south-1 build is a separate ~6–10 day DevOps effort, already specced.
