# MobiCova Health — Production Deployment Runbook (AWS af-south-1)

> A step-by-step guide to stand up the **Tier B** production environment yourself:
> high-availability, multi-AZ, encrypted, in the **AWS af-south-1 (Cape Town)** region for
> African data residency. Pairs with the target-architecture and data-residency diagrams.
>
> **Shape of the system:** Cloudflare edge → ALB → ECS Fargate API (≥2 tasks, 2 AZs) →
> RDS PostgreSQL (Multi-AZ) + ElastiCache Redis + object storage; CloudFront for the static
> client. Each phase has a **goal**, **steps**, and a **✓ checkpoint** before you move on.

> ⏱ **Realistic effort:** ~6–10 working days for a first build (more if also doing SOC 2).
> 💡 **Strongly recommended:** express all of this as **Terraform (IaC)** so it's reproducible,
> reviewable, and rebuildable for DR. The console steps below map 1:1 to Terraform resources.

---

## Phase 0 — Account, guardrails & decisions

**Goal:** a safe, well-governed AWS account before anything is created.

1. Use a dedicated AWS account (or Organisation sub-account) for production — **separate from UAT**.
2. Lock down the root user (MFA, no access keys); create an **IAM admin user/role** for daily work.
3. Set the region to **`af-south-1`** (note: it's an opt-in region — enable it in *Account → Regions*).
4. Create an **AWS Budget** + billing alarm (e.g. alert at $1k, $3k, $5k/mo).
5. Turn on **CloudTrail** (audit), **GuardDuty** (threat detection), and **AWS Config** (compliance) — also useful evidence for SOC 2.
6. **Decisions to lock now:**
   - **Object storage:** the app currently uses **Supabase Storage** (`SUPABASE_*` env vars). For true residency, plan to migrate file storage to **S3** (small code change in the storage helper). If you keep Supabase Storage short-term, note that uploaded files then live outside the af-south-1 boundary.
   - **Live integration keys** ready and kept **out of the repo**: Stripe/Paystack **live**, WhatsApp **production** number, Anthropic prod key, Resend verified domain.
   - **Never** set `OTP_DEV_MODE` or `DEMO_SEED_PASSWORD` in production.

**✓ Checkpoint:** billing alarms active, CloudTrail logging, admin role works, af-south-1 enabled.

---

## Phase 1 — Network & platform foundation

**Goal:** an isolated VPC and the shared building blocks.

1. **VPC** across **2 availability zones** with three subnet tiers per AZ:
   - **public** (ALB, NAT gateway), **private-app** (ECS tasks), **private-data** (RDS, Redis).
2. **NAT gateway** (one per AZ for HA) so private subnets can reach the internet for outbound calls.
3. **Security groups** (least privilege):
   - ALB SG: inbound 443 from internet → ECS SG.
   - ECS SG: inbound from ALB SG only; outbound to DB/Redis SGs + internet (via NAT).
   - DB SG / Redis SG: inbound **only** from ECS SG.
4. **KMS** customer-managed keys for RDS, S3, Secrets Manager (encryption at rest).
5. **AWS Secrets Manager** — where all production secrets will live.
6. **ECR** repository (`mobicova-api`) for the container image.

**✓ Checkpoint:** VPC + subnets + route tables + SGs created; ECR repo exists; KMS keys created.

---

## Phase 2 — Data tier

**Goal:** durable, HA, encrypted stores in the private-data subnets.

1. **RDS PostgreSQL** (or Aurora PostgreSQL):
   - **Multi-AZ** (primary + standby, automatic failover).
   - Encrypted at rest (KMS), **automated backups + PITR** (retain ≥ 7 days), deletion protection on.
   - In the private-data subnet group; SG allows only the ECS SG.
   - (Optional) add a **read replica** for reporting/analytics queries.
   - Grab the **RDS CA certificate** PEM → this becomes `DATABASE_CA_CERT`.
2. **ElastiCache for Redis** — Multi-AZ replication group, in private-data subnets, SG from ECS only. (Used for sessions, cache, rate-limit, and the job queue.)
3. **S3 bucket** for object storage — private, **block public access**, versioning on, encrypted (KMS). (Target for the Supabase-Storage → S3 migration.)
4. **Run migrations** against the prod DB (see Phase 4 for the one-off ECS task), using a build that exposes a prod-safe command — add to `server/package.json`:
   ```json
   "migrate:prod": "node dist/db/migrate.js"
   ```
   (Migrations compile to `dist/` via `tsc`, so prod doesn't need `tsx`/devDeps.)

**✓ Checkpoint:** can connect to RDS from a temporary task in the VPC; Redis reachable; S3 bucket private + encrypted.

---

## Phase 3 — Containerise & publish the API

**Goal:** a production image in ECR.

1. Add a `server/Dockerfile`:
   ```dockerfile
   # --- build stage ---
   FROM node:22-slim AS build
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build            # tsc -> dist (compiles app + migrations)

   # --- runtime stage ---
   FROM node:22-slim AS runtime
   WORKDIR /app
   ENV NODE_ENV=production
   COPY package*.json ./
   RUN npm ci --omit=dev
   COPY --from=build /app/dist ./dist
   EXPOSE 8080
   USER node
   CMD ["node", "dist/server.js"]
   ```
2. Build, tag, and push to ECR:
   ```bash
   aws ecr get-login-password --region af-south-1 | docker login --username AWS --password-stdin <acct>.dkr.ecr.af-south-1.amazonaws.com
   docker build -t mobicova-api ./server
   docker tag mobicova-api:latest <acct>.dkr.ecr.af-south-1.amazonaws.com/mobicova-api:<git-sha>
   docker push <acct>.dkr.ecr.af-south-1.amazonaws.com/mobicova-api:<git-sha>
   ```
   (Confirm the app honours `PORT` — set it to `8080` in the task definition.)

**✓ Checkpoint:** image visible in ECR; `docker run` locally serves `/health` 200.

---

## Phase 4 — Compute (ECS Fargate + ALB)

**Goal:** redundant API behind a load balancer.

1. **ACM certificate** for `api.yourdomain` (DNS-validated) in af-south-1.
2. **Application Load Balancer** in the public subnets; HTTPS:443 listener using the ACM cert; HTTP:80 → redirect to 443.
3. **Target group** (IP type), health check path **`/health`**.
4. **ECS cluster** (Fargate) + **task definition**:
   - container = the ECR image, port 8080, `PORT=8080`.
   - env/secrets injected from **Secrets Manager** (see Phase 7).
   - CPU/memory sized (start 0.5 vCPU / 1 GB), logs → CloudWatch.
5. **ECS service**: desired count **≥ 2**, spread across both AZs, attached to the ALB target group.
6. **Auto-scaling**: target-tracking on CPU/memory (e.g. scale out at 60% CPU).
7. **Migrations**: run a **one-off ECS task** using the same image with command override `node dist/db/migrate.js` **before** sending traffic.

**✓ Checkpoint:** ALB DNS serves `/health` 200; killing one task auto-replaces it with zero failed requests.

---

## Phase 5 — Frontend (static client)

**Goal:** the React app on a global CDN.

1. Build with the prod API URL: `VITE_API_URL=https://api.yourdomain` → `npm run build` (output `client/dist`).
2. **S3 bucket** (private) + **CloudFront** distribution with **Origin Access Control**, ACM cert for `app.yourdomain`, and an SPA fallback (403/404 → `/index.html`, 200).
3. Upload `dist/` to S3; invalidate CloudFront on each release.

> Alternative: host the client on **Cloudflare Pages** for simpler edge hosting — your call.

**✓ Checkpoint:** `https://app.yourdomain` loads, talks to the API, deep links resolve.

---

## Phase 6 — Edge, DNS & TLS (Cloudflare)

**Goal:** protected, fast entry points.

1. **DNS:** `api.yourdomain` → ALB; `app.yourdomain` → CloudFront.
2. **WAF** rules (managed OWASP ruleset + bot mitigation), **rate limiting**, **DDoS** protection.
3. **TLS/HSTS** end-to-end; security headers (CSP, X-Frame-Options, etc.).
4. Keep a **Lagos PoP** in play for low-latency African delivery.

**✓ Checkpoint:** WAF blocks an injection probe; SSL Labs / security-header scan grades A.

---

## Phase 7 — Secrets & production config

**Goal:** every secret managed, nothing in the repo.

Store these in **Secrets Manager** and inject into the ECS task. **Production / LIVE values only.**

| Variable | Notes |
|----------|-------|
| `NODE_ENV` | `production` |
| `APP_ENV` | `production` |
| `PORT` | `8080` (match the task/ALB) |
| `DATABASE_URL` | RDS primary endpoint (SSL) |
| `DATABASE_CA_CERT` | RDS CA PEM (verifies DB TLS) |
| `JWT_SECRET` | strong, unique |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `CLIENT_URL` / `SERVER_URL` | `https://app.…` / `https://api.…` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | prod key |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | **live** |
| `PAYSTACK_SECRET_KEY` | **live** |
| `RESEND_API_KEY` / `EMAIL_FROM` | verified domain |
| `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` | production number |
| `PLATFORM_ADMIN_EMAILS` | your platform admins |
| Object storage | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` **or** S3 vars after migration |

⛔ **Do NOT set in prod:** `OTP_DEV_MODE` (must be off — real OTPs), `DEMO_SEED_PASSWORD` (no demo seed).
🔁 Enable **rotation** for `JWT_SECRET`, DB creds, and API keys.

**✓ Checkpoint:** ECS task starts cleanly with all secrets; no secret appears in logs or the repo.

---

## Phase 8 — Observability & alerting

**Goal:** you can see and be paged about problems.

1. **CloudWatch**: container logs, metrics, and **alarms** (5xx rate, p95 latency, CPU, DB connections, Redis evictions, queue depth).
2. **Error tracking**: Sentry on API + client (release tagging, source maps).
3. **Uptime / synthetic checks**: external monitor hitting `/health` and a login flow from multiple regions.
4. **On-call**: route alarm → pager (e.g. Better Stack / PagerDuty) on SLO breach.

**✓ Checkpoint:** an injected 5xx spike fires an alarm and pages within minutes; dashboards show live latency.

---

## Phase 9 — CI/CD: promote to production

**Goal:** safe, repeatable releases (UAT → Prod).

Recommended GitHub Actions flow on a **release tag** (`vX.Y`):
1. Build + type-check (reuse the UAT gate).
2. Build the Docker image → push to ECR (`:<git-sha>`).
3. **Run the migration task** (`node dist/db/migrate.js`) against prod DB.
4. **Update the ECS service** to the new image (rolling deploy; ECS waits for healthy targets).
5. Invalidate CloudFront for the client.
6. **Smoke test** the live `/health` + a key path; **manual approval gate** before the ECS update.

Rollback = re-point the ECS service to the previous image tag (keep the last N images in ECR).

**✓ Checkpoint:** a tagged release deploys end-to-end; a deliberate bad build is blocked at the gate; rollback works in < 5 min.

---

## Phase 10 — Go-live cutover

**Goal:** flip to live safely.

1. Final **migration** applied; verify schema.
2. **Seed only real admin accounts** (no demo data); create the platform admin(s).
3. Point **live webhooks** to prod API: WhatsApp (Meta), Africa's Talking (USSD/SMS), Stripe/Paystack.
4. Configure **payment** live keys + webhook secrets; do a 1-unit test transaction, then refund.
5. **DNS cutover** to prod (low TTL beforehand).
6. **Smoke test** all channels (web, WhatsApp, USSD), enrolment → membership ID, OTP login, a claim.
7. **Watch dashboards** for the first hours; keep the rollback ready.

**✓ Checkpoint:** real enrolment via each channel works; payments + OTP live; error rate flat.

---

## Phase 11 — Post-launch hardening

- **Verify backups** and run a **restore drill** (RDS snapshot → temp instance) — prove RPO ≤ 5 min, RTO ≤ 30 min.
- Write the **DR runbook** (failover + restore steps, contact tree).
- **Cost review** after week 1 (right-size ECS/RDS, check NAT/data-transfer).
- Start the **SOC 2 / ISO 27001** observation window and book the **penetration test** (see production plan).

---

## Quick sequence (dependency order)

```
0 Account/guardrails → 1 VPC/SG/KMS/ECR → 2 RDS+Redis+S3 → 3 Docker→ECR
→ 4 ALB+ECS (+migrate task) → 5 S3+CloudFront client → 6 Cloudflare/WAF/DNS
→ 7 Secrets → 8 Observability → 9 CI/CD → 10 Cutover → 11 Hardening
```

## If full AWS-native feels too heavy
You can run a **hardened managed** prod (Render/Supabase scaled + Cloudflare) far faster, trading
**African data residency** (it would sit in the EU) and some control. Given residency + SOC 2 are
firm requirements, AWS af-south-1 is the right destination — but a managed interim is a valid
bridge while you build this out. See the production plan's Tier A vs Tier B comparison.
