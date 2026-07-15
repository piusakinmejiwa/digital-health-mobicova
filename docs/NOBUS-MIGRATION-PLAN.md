# Migration Plan — Render + Supabase → Nobus Cloud (in-Nigeria)

Moving MobiCova from the current managed stack to the Nobus environment accepted in
principle (2026-07). Goal: everything — compute, database, object storage, backups —
runs inside Nigeria, with a controlled cutover and a clean rollback path.

---

## 1. What moves where

| Component | Today | Nobus target |
|---|---|---|
| API (Node/Express, Docker) | Render | 2× FCS Linux VM (Docker), one per Lagos AZ, behind HAProxy LB |
| React SPA | Render | Nginx on the app tier (same VMs) |
| PostgreSQL | Supabase | Managed PostgreSQL 16 (3-node HA, single-tenant) |
| Redis | current provider | FCS Linux VM (Docker) |
| Object storage (claim docs/images) | **Supabase Storage** | **FOS (S3-compatible)** — the one real code change |
| DB backups | Supabase PITR | Managed-PG PITR + Nobus Cloud Backup (30-day, independent copy) |
| Domain | `api.mobicovahealth.com` | same domain → repoint DNS to the Nobus LB |

---

## 2. Workstreams (run in parallel)

**A. Infrastructure (Nobus, ~48 h after contract).** VPC/subnets, the instances, Managed
PostgreSQL, FOS buckets, load balancer, VPN, backup, and dashboard + SSH access. Nobus-owned.

**B. Code changes (us).**
- **Object storage helper → FOS.** `server/src/lib/storage.ts` + `server/src/config/storage.ts`
  currently target Supabase Storage. FOS is S3-compatible, so switch the helper to the AWS
  S3 SDK (endpoint = FOS, path-style), driven by env. This is the only functional code change
  the migration requires. Build + test it in staging first.
- **Config / env mapping** (see §5).
- **Deployment path:** either (a) a CI/CD pipeline so `git push` builds + ships to the two
  VMs, or (b) take Nobus's **managed-Docker** offer and hand them the image. Decide once their
  managed-Docker price lands.

**C. Data migration (us + verify).**
- Database: `docs/pre-cutover-snapshot.sh` → `pg_dump` from Supabase (session pooler) →
  `pg_restore` into Managed PostgreSQL. Run migrations first so the schema matches, or restore
  the full public schema — decide during the dry run.
- Object storage: copy existing files Supabase Storage → FOS (a one-off sync script, or
  `rclone` with an S3 remote pointed at FOS).
- Reconcile: row counts per table, object counts, and spot-checks.

**D. Cutover.** DNS, webhooks, secrets (see §4).

**E. Validation + monitoring.** Health checks, USSD self-test, a test enrolment/claim/payment,
notifications; Sentry + uptime + the USSD monitor pointed at the new host.

**F. Decommission.** After a stable window, tear down Render, and **delete the Supabase data**
(and the snapshot once no longer needed) per the data-residency policy.

---

## 3. Phased sequence

- **Phase 0 — Prep.** Contract signed; Nobus dashboard/SSH access; lower DNS TTL on
  `api.mobicovahealth.com` to ~300 s a day ahead; freeze non-critical changes.
- **Phase 1 — Provision.** Nobus builds the environment; we get credentials + endpoints.
- **Phase 2 — Build on Nobus (prod still live).** Deploy app + Redis to the VMs, run DB
  migrations against Managed PG, wire env vars, stand up the FOS storage path. Nothing points
  at Nobus publicly yet.
- **Phase 3 — Dry run.** Full `pg_dump`/`restore` + object-storage sync into Nobus; smoke-test
  the app end-to-end against the Nobus stack on a temporary URL. Fix, repeat until clean.
- **Phase 4 — Cutover** (maintenance window — see §4).
- **Phase 5 — Stabilise.** Watch closely for 24–72 h; keep Supabase intact (read-only) as the
  rollback anchor.
- **Phase 6 — DR test + decommission.** Joint failover test with Nobus (validate RTO ≤ 4 h),
  then retire the old stack and purge Supabase data.

---

## 4. Cutover runbook (maintenance window)

1. **Announce** a short maintenance window (low-traffic time — early morning WAT).
2. **Freeze writes:** put the app in maintenance mode so no new data lands in Supabase.
3. **Final data sync:** run `pre-cutover-snapshot.sh`, `pg_restore` into Managed PG, and do the
   final object-storage sync (delta since the dry run).
4. **Point the app at Nobus:** confirm the Nobus app instances have the production env (DB URL =
   Managed PG, storage = FOS, all keys). Smoke-test on the temporary URL.
5. **Switch DNS:** repoint `api.mobicovahealth.com` (and the frontend host) to the Nobus LB.
   Because the domain is unchanged, **webhook URLs stay the same** — but verify:
   - Africa's Talking USSD callback resolves to Nobus (re-check per `docs/USSD-OPERATIONS.md`).
   - Meta WhatsApp webhook, Paystack/Stripe webhooks resolve to Nobus.
6. **Validate:** `/healthz`, `/readyz`, `/channels/ussd/selftest`, a test login/enrolment, a
   claim action, a payment webhook, an email/SMS send.
7. **Lift maintenance mode.** Monitor.

**Rollback (any time before step 7 passes):** revert DNS to the old host and point the app's
`DATABASE_URL`/storage back to Supabase. Because Supabase stays live and read-intact through
Phase 5, rollback is a DNS + config revert, not a data recovery.

---

## 5. Env vars to set on Nobus

| Purpose | Var(s) | Change |
|---|---|---|
| Database | `DATABASE_URL` | → Managed PostgreSQL (in-Nigeria) |
| Object storage | S3/FOS: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (replacing `SUPABASE_*`) | new, after helper change |
| Auth continuity | `JWT_SECRET`, `SESSION`/epoch keys | **keep identical** or all users are logged out at cutover |
| AI, messaging, email, payments | `ANTHROPIC_API_KEY`, `AT_*`, `WHATSAPP_*`, `RESEND_API_KEY`, Paystack/Stripe | carry over unchanged |
| Webhook auth | `AT_WEBHOOK_TOKEN`, `HEALTH_TIPS_CRON_SECRET` | carry over; good moment to set `AT_WEBHOOK_TOKEN` if still unset |
| Monitoring | `SENTRY_DSN`, `PLATFORM_SLACK_WEBHOOK_URL` | carry over |

---

## 6. Risks & mitigations

- **Data residency during migration.** The `pg_dump` snapshot and any transit must stay in
  Nigeria/controlled; delete the Supabase copy after cutover per NDPR/DPA.
- **Downtime.** Keep the window short by doing a full dry run first (Phase 3) so the live cutover
  is only the delta.
- **Object-storage change is the main code risk.** Isolated to two files, but test upload +
  retrieval of a claim document in staging before cutover.
- **Session continuity.** Reuse `JWT_SECRET` (and the session epoch) so tokens survive; otherwise
  plan a forced re-login and tell users.
- **Webhooks.** Same domain means URLs don't change — but re-verify each provider resolves to
  Nobus post-DNS (USSD is the one that bit us before).
- **Cold starts gone.** Nobus VMs are always-on, so the USSD cold-start problem disappears — but
  keep the USSD monitor running through the transition.

---

## 7. Decisions needed before we schedule

1. **Managed Docker vs CI/CD** — pending Nobus's managed-Docker price (asked in the acceptance).
2. **Cutover window** — date/time (low traffic; coordinate with AXA if live members exist).
3. **How much live data exists now** — sets how tight the downtime window must be.

See also: `docs/pre-cutover-snapshot.sh` (DB snapshot), `docs/USSD-OPERATIONS.md` (webhook
re-verification), and the accepted Nobus proposal for the target architecture.
