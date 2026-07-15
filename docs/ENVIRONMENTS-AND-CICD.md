# Environments & CI/CD Design

How MobiCova promotes code across environments with a `git push`, safely. Agreed
design (2026-07); implementation phased alongside the Nobus migration.

```
feature/*  ──PR──▶  main ─────────────▶  STAGING     (auto-deploy on every merge)
                     │
                     ├── git push main:production ──▶ [1-click approval] ──▶ PRODUCTION
                     └── git push main:demo       ─────────────────────────▶ DEMO
```

## 1. Environments

| | DEV | STAGING | PRODUCTION | DEMO |
|---|---|---|---|---|
| Purpose | Build features | Validate the release | Live service (AXA) | Sales demos |
| Data | Local seed | Synthetic / anonymised (no real PHI) | Real member PHI | Curated fake data (resettable) |
| Hosting | Laptop | Nobus (in proposal) | Nobus HA + DR (in proposal) | **Cheap host outside Nobus** (Render / small VM) |
| In-Nigeria residency | n/a | nice-to-have | **required** | not required (no real PHI) |
| Branch | feature/* | `main` | `production` | `demo` |
| Deploy trigger | — | auto on merge to `main` | `git push origin main:production` → **1-click approval** | `git push origin main:demo` |

DEMO deliberately sits **off Nobus** — fake data means no residency constraint, so it
runs on a cheap box and saves a Nobus environment fee, while still running the *same
tested image*.

## 2. Core principle — build once, promote the same artifact

The image built and tested against STAGING is the **exact** image that goes to PROD and
DEMO. Nothing is rebuilt per environment. Only **config** (DB URL, storage bucket, keys,
branding, feature flags) differs. This eliminates "worked in staging, broke in prod."

- On merge to `main`: CI builds `mobicova-api:<git-sha>` and pushes it to the container
  registry (GHCR, or the Nobus registry).
- Each environment deploy = **pull that tag + run it** with the environment's config.
- Promotion moves the *same* `<git-sha>` forward; it never triggers a rebuild.

## 3. Pipeline stages

1. **PR opened** → CI: `tsc` typecheck + `vitest` + client build. Nothing deploys.
2. **Merge to `main`** → CI builds + pushes the image → **deploy to STAGING** → run DB
   migrations against staging → smoke-check `/healthz` + `/readyz`.
3. **`git push origin main:production`** → the production deploy workflow stages, then
   **waits for one-click approval** (GitHub Environment protection on `production`) →
   on approval: pull the same image, **run migrations against prod DB**, deploy behind the
   LB, smoke-check.
4. **`git push origin main:demo`** → deploy the same image to DEMO with demo config; can be
   reset/reseeded on demand.

## 4. Migrations — automated in the pipeline

We already have the runner (`npm run migrate` → `src/db/migrate.ts`) and drift detection
(`migrateStatus.ts`). The deploy job runs `migrate` against **that environment's** database
*before* switching traffic, so schema and code ship together. This removes the current
manual-paste-in-Supabase step and its "forgot the SQL" risk. `MIGRATIONS_STRICT=true` on
prod makes `/readyz` refuse traffic if a migration is still pending — a backstop.

## 5. Config & secrets per environment

Per-environment secrets live in **GitHub Environments** (`staging`, `production`, `demo`),
with `production` requiring a reviewer to approve. Each environment sets its own:

| Group | Vars |
|---|---|
| Database | `DATABASE_URL` (staging/prod = Nobus Managed PG; demo = its own) |
| Object storage | S3/FOS: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| Auth | `JWT_SECRET` (distinct per env; prod value known only to prod) |
| Deploy target | `SSH_HOST`, `SSH_KEY` (the env's VM(s)) |
| Integrations | `ANTHROPIC_API_KEY`, `AT_*`, `WHATSAPP_*`, `RESEND_API_KEY`, payments |
| Monitoring | `SENTRY_DSN`, `PLATFORM_SLACK_WEBHOOK_URL` |

Demo uses **sandbox/test keys** (test Paystack/Stripe, AT sandbox) so a demo can never
send a real SMS or take a real payment.

## 6. Frontend (React SPA)

Vite env vars are build-time, so the SPA is built per environment (`VITE_API_URL`,
`VITE_SENTRY_DSN` differ). Either build three times in CI, or inject a small runtime
`config.json` the app reads on load (avoids rebuilds). Served by Nginx on the app tier.

## 7. Data strategy

- **Prod:** real PHI, backed up (Managed-PG PITR + NCB), never copied down to lower envs raw.
- **Staging:** synthetic or **anonymised** data — safe to wipe/reset; parity with prod schema.
- **Demo:** a curated seed (`npm run seed` extended with a demo dataset) — realistic but fake;
  a "reset demo" action reseeds it before a big pitch.
- **Dev:** local seed.

## 8. Implementation roadmap

**Can build now (independent of Nobus provisioning):**
1. CI workflow: PR checks + build/push image to GHCR on `main`.
2. Wire `npm run migrate` into the deploy job (auto-migrations).
3. `docker-compose` templates per environment (app + Redis + Nginx).
4. Create the `production` and `demo` branches + GitHub Environment protections.
5. Refactor the existing `production.yml` / `release.yml` / `uat.yml` into the
   staging/prod/demo model.

**Waits for Nobus provisioning (needs real hosts/keys/DNS):**
6. Deploy workflows' SSH targets for staging/prod; the demo host.
7. First end-to-end deploy + smoke tests; DNS.

See also: `docs/NOBUS-MIGRATION-PLAN.md` (the environment move) and
`docs/pre-cutover-snapshot.sh`.
