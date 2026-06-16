# Phase 1 — Reliability Foundation (Engineering Spec)

> The concrete hardening we can start **now**, mostly on the current managed stack,
> before any cloud-native cutover. Goal: remove the single points of failure and gain
> real visibility — the biggest reliability gain per dollar.
>
> **Target after Phase 1:** 99.9% availability · RPO ≤ 5 min · RTO ≤ 30 min.

---

## 0. Where we are vs. where Phase 1 lands us

| Capability | MVP today | After Phase 1 |
|------------|-----------|---------------|
| API redundancy | 1 instance (SPOF) | ≥2 instances behind a load balancer, auto-replaced on failure |
| Database resilience | single instance | HA primary + standby, automated failover, PITR backups, tested restore |
| Background work | inline in request | Redis-backed job queue (emails, webhooks, OTP, notifications) |
| Edge protection | none | Cloudflare CDN + WAF + DDoS + rate limiting |
| Deploys | manual `git push` to prod | CI/CD with a staging env + safe rollout + one-click rollback |
| Visibility | console logs | error tracking, uptime monitoring, metrics, alerting, on-call |
| Secrets | env vars | managed secrets + rotation policy |
| Recovery | hope | documented runbook + a rehearsed restore drill |

---

## 1. Workstreams

### W1 — High-availability database + backups
**Why:** the database is the highest-impact single point of failure.
- Enable **standby replica with automatic failover** (Supabase Team / RDS Multi-AZ).
- Turn on **Point-in-Time Recovery** (retain ≥ 7 days) and **daily automated backups**.
- Add a **read replica** to offload analytics/report queries from the primary.
- Connection pooling already in use (PgBouncer/Supabase pooler) — confirm sized for ≥2 API instances.

**Acceptance:** kill the primary in a test window → app recovers automatically within RTO; restore a table to a point in time on staging successfully.
**Effort:** S (config-led).

### W2 — Redundant API behind a load balancer
**Why:** no single API instance should take the platform down.
- Run **≥2 API instances**, multi-AZ, behind a **load balancer** with **health checks** (`/health` endpoint) and automatic replacement of unhealthy instances.
- Enable **autoscaling** on CPU/RAM thresholds.
- Make the API **stateless** — move any in-memory session/intake state to Redis (see W3) so any instance can serve any request.

**Acceptance:** terminate one instance under load → zero failed requests; load test sustains target concurrency with autoscale.
**Effort:** S–M (needs a stateless-session check).

### W3 — Redis: cache, rate-limit, sessions & job queue
**Why:** spikes (USSD/WhatsApp bursts, OTP sends) must not block web requests; state must be shared across instances.
- Stand up **managed Redis** (Upstash / ElastiCache).
- Move **intake-session state** and any short-lived auth state into Redis (enables W2).
- Add a **job queue (BullMQ)** and move to it: welcome/activation emails, webhook deliveries, OTP/SMS sends, WhatsApp/USSD outbound, bulk-import notifications.
- Add **distributed rate limiting** (per-IP and per-API-key) backed by Redis.

**Acceptance:** email/webhook/SMS sends happen via workers with retry + dead-letter; a burst of 1k inbound channel messages doesn't raise web latency.
**Effort:** M (touches several controllers).

### W4 — Edge: CDN + WAF + DDoS
**Why:** absorb attacks and bad traffic before they reach the API.
- Front everything with **Cloudflare**: DNS, CDN caching for static assets, **WAF** rules, **DDoS** protection, bot mitigation.
- Enforce **HTTPS/HSTS**, sensible **security headers** (CSP, X-Frame-Options, etc.).
- Cache the static client at the edge (incl. Lagos PoP) for fast African delivery.

**Acceptance:** WAF blocks common injection/abuse patterns in test; security-header scan grades A.
**Effort:** S.

### W5 — CI/CD + staging + safe rollout
**Why:** ship without manual risk; recover fast from a bad deploy.
- Add a **staging environment** mirroring prod (separate DB).
- **CI pipeline:** typecheck + build + run migrations check + smoke tests on every PR.
- **CD:** auto-deploy to staging; promote to prod with **blue-green / canary** and **one-click rollback**.
- Wire the existing `smoke-test.ps1` / `e2e-live-test.ps1` into the pipeline as gates.

**Acceptance:** a deliberately broken build is blocked by CI; a prod deploy can be rolled back in < 2 min.
**Effort:** M.

### W6 — Observability & on-call
**Why:** you can't run an industrial platform you can't see.
- **Error tracking:** Sentry on client + server (release tagging, source maps).
- **Uptime + synthetic checks:** Better Stack / Checkly hitting `/health` and a login flow from multiple regions.
- **Metrics & logs:** centralised structured logs + key dashboards (request rate, p95 latency, error rate, DB connections, queue depth).
- **Alerting + on-call:** page on SLO breach (error rate, latency, uptime, queue backlog) into a rota.

**Acceptance:** an injected 500-spike pages within minutes; dashboards show p95 latency and queue depth live.
**Effort:** M.

### W7 — Secrets & config hygiene
- Move secrets to a **managed secrets store**; remove any secrets from chat/history; **rotate** the keys shared during testing (incl. the platform-admin password and any API keys).
- Document a **rotation policy** and least-privilege access.

**Acceptance:** no secret in source/CI logs; rotation runbook exists.
**Effort:** S.

### W8 — DR runbook + restore drill
- Write a **runbook**: failover steps, restore-from-PITR steps, contact tree, comms-channel fallback.
- Run a **game-day**: restore prod to staging from backup, time it against RTO/RPO.

**Acceptance:** a rehearsed restore meets RTO ≤ 30 min, RPO ≤ 5 min.
**Effort:** S–M.

---

## 2. Sequence & rough timeline (~2–4 weeks)

| Order | Items | Notes |
|-------|-------|-------|
| 1 | W1 (HA DB + PITR), W7 (secrets/rotate) | Foundational + quick risk reduction |
| 2 | W3 (Redis + queue + stateless state) | Unblocks W2 |
| 3 | W2 (≥2 API + LB + autoscale) | Depends on stateless sessions from W3 |
| 4 | W4 (Cloudflare WAF/CDN), W6 (observability) | Run in parallel |
| 5 | W5 (CI/CD + staging) | Lock in safe delivery |
| 6 | W8 (DR runbook + restore drill) | Validate the whole thing |

S = ~1–2 days · M = ~3–5 days (single engineer). Several can overlap.

---

## 3. What we can start today on the current stack

Without waiting for the AWS cutover, we can land **W1, W3, W4, W5, W6, W7** on the
managed stack immediately — that alone removes the DB and API single points of failure,
adds the queue, and gives full visibility. W2's load-balanced multi-instance setup is the
one piece that benefits most from the cloud-native move, but a 2-instance managed setup is
a valid interim.

**Suggested first PR:** add `/health`, stand up Redis, and move outbound email/SMS/webhook
sends onto a BullMQ queue with retries — it's self-contained, immediately improves
resilience, and is a prerequisite for horizontal scaling.
