# MobiCova Health — Production Readiness & Cost Plan

> Moving from a single-region MVP to an industrial-grade platform: fault tolerance,
> failover, load balancing, observability, and compliance.
>
> **All figures are planning-grade estimates in USD ranges — not quotes.** They are
> sized to the assumptions below and will move with real traffic, comms volume, and
> vendor negotiation.

---

## 0. Assumptions locked for this plan

| Variable | Decision |
|----------|----------|
| **Scale horizon** | Up to ~50,000 active members |
| **Data residency / region** | Nigeria / Africa |
| **Approach costed** | Both — Tier A (hardened managed) **and** Tier B (cloud-native AWS), side by side |
| **Compliance target** | NDPR + penetration test **+ SOC 2 / ISO 27001** |

### The residency ↔ approach trade-off (important)
- **Render (Tier A) has no African region.** Tier A would run in **EU (Frankfurt/London)** with a Cloudflare **Lagos edge** for fast static/CDN delivery — data-at-rest sits in the EU.
- **AWS `af-south-1` (Cape Town)** keeps data **on-continent**, and AWS has a **Lagos Local Zone + CloudFront edge** for low latency into Nigeria. This is the only one of the two that satisfies true African residency.
- **NDPR** permits cross-border transfer with adequate safeguards, so EU hosting is *legally workable* — but health data is sensitive and enterprise insurer buyers will ask "where does it live?", which favours Cape Town or a local DC.
- **Net:** if residency + SOC 2 are firm, the **destination is Tier B**. Tier A is still useful as a fast interim hardening step, but avoid investing heavily in it only to migrate later.

---

## 1. What "industrial-grade" means here

You are buying four things:

- **Availability target** — e.g. **99.9%** (~8.7 h/yr down), 99.95%, or 99.99%. Each extra "nine" multiplies cost.
- **Fault tolerance / failover** — no single server, Availability Zone, or DB instance can take the platform down.
- **Recoverability** — **RPO** (max data loss, target ≤ 5 min) and **RTO** (max downtime to recover, target ≤ 30 min) via standby + point-in-time backups.
- **Security & compliance** — health data + payments + Nigerian PII → NDPR, PCI offloaded to Stripe/Paystack, and SOC 2 / ISO 27001 for enterprise procurement.

**Recommended target for 50k:** **99.9% availability, RPO ≤ 5 min, RTO ≤ 30 min.**

---

## 2. Target architecture (vs. today)

| Layer | MVP today | Industrial-grade target |
|-------|-----------|-------------------------|
| DNS / edge | Render domain | **Cloudflare** DNS + CDN + **WAF** + DDoS, Lagos edge |
| Frontend | Render static | Static on CDN (already cheap & resilient) |
| API | 1 Render service | **≥2 containers, multi-AZ, behind a load balancer, auto-scaling**, health-checked & auto-replaced |
| Database | Supabase (single) | **Managed HA Postgres** — primary + standby (auto-failover), **read replica**, **PITR backups** |
| Cache / queue | none | **Redis** (sessions, rate-limit, cache) + **job queue** (emails, webhooks, OTP) so spikes don't block requests |
| Object storage | Supabase Storage | S3 / multi-AZ object storage (fine as-is) |
| Secrets | env vars | Managed **secrets store** + rotation |
| Observability | console logs | **Logs + metrics + traces + error tracking + uptime alerts + on-call** |
| Delivery | manual git push | **CI/CD with staging + blue-green/canary deploys**, infra-as-code (Terraform) |
| Region | one | Africa-proximate + optional multi-region DR (later) |

---

## 3. Tier A vs Tier B — side by side

| Dimension | **Tier A — Hardened Managed** | **Tier B — Cloud-native AWS** |
|-----------|-------------------------------|-------------------------------|
| Stack | Render (scaled) + Supabase Team + Cloudflare + Upstash + Sentry/Better Stack | ECS Fargate + RDS/Aurora Multi-AZ + ElastiCache + CloudFront + WAF + Datadog/Grafana, on Terraform |
| Region | **EU (Frankfurt/London)** + Lagos CDN edge | **AWS af-south-1 (Cape Town)** + Lagos edge — true African residency |
| Scales to | Tens of thousands comfortably | Millions |
| Ops burden | Low (vendor-managed) | Higher (you own the infra) |
| SOC 2 / ISO fit | Workable (rely on sub-processor reports) | Stronger control & evidence story |
| Setup effort | ~2–4 weeks | ~6–10 weeks |
| Best as | Fast interim hardening | The destination for your requirements |

---

## 4. Monthly run-rate (infrastructure only) at ~50k members

### Tier A — Hardened Managed (EU-hosted)
| Item | Est. /month |
|------|-------------|
| Render API — 2–3 instances, autoscale + HA | $200 – $500 |
| Supabase **Team** + compute upgrade + read replica + PITR | $700 – $1,400 |
| Cloudflare Pro/Business (WAF, DDoS) | $20 – $250 |
| Upstash Redis | $10 – $100 |
| Resend (email) | $20 – $90 |
| Monitoring (Sentry + Better Stack) | $50 – $300 |
| **Subtotal** | **≈ $1,200 – $2,500 / mo** |

### Tier B — Cloud-native AWS (af-south-1, ~20–30% region premium included)
| Item | Est. /month |
|------|-------------|
| ECS Fargate (2–3 tasks, multi-AZ) + ALB | $130 – $350 |
| RDS/Aurora PostgreSQL Multi-AZ (+ read replica) | $300 – $700 |
| ElastiCache Redis (multi-AZ) | $60 – $150 |
| S3 + CloudFront (Lagos edge) | $30 – $150 |
| WAF + Shield Standard | $30 – $100 |
| NAT gateway, Secrets Manager, data transfer | $100 – $250 |
| Observability (Datadog, or cheaper self-hosted Grafana) | $200 – $600 |
| **Subtotal** | **≈ $1,500 – $3,000 / mo** |

> **At 50k scale the two run-rates are close (~$1.2k–$3k/mo).** The real difference is
> **setup cost, ops burden, residency, and headroom** — not the monthly server bill.

---

## 5. The costs that dominate at scale (usage-based — often bigger than servers)

| Variable cost | Driver | Order of magnitude at ~50k |
|---------------|--------|----------------------------|
| **WhatsApp Business** | per-template-message (Meta), Nigeria | ~$0.01–$0.05 each → **$1k–$10k/mo**, volume-driven |
| **SMS / OTP** | per-message via Termii/Africa's Talking/telco | local routes cheap (~$0.002–0.003); intl OTP pricier |
| **USSD sessions** | telco / Africa's Talking per-session + shortcode rental | volume-driven; possible revenue-share |
| **Claude (AI triage)** | per-token usage | ~$200–$1,500/mo at moderate use |
| **Payments** | Paystack ~1.5% / Stripe ~2.9% | % of money moved (pass-through) |

**Lever:** prefer cheaper **utility/auth** WhatsApp templates over marketing ones, batch
notifications, and route OTP through local Nigerian SMS aggregators to control this line.

---

## 6. One-time setup costs

| Workstream | Tier A | Tier B |
|------------|--------|--------|
| Infra build-out / IaC / CI/CD / staging / monitoring / runbooks | $8k – $25k (~2–4 wks) | $30k – $70k (~6–10 wks) |
| Data migration (Supabase → target) | minimal | included above |
| Load & failover testing | included | included |

(Lower end assumes we build it together; upper end assumes a contract DevOps engineer.)

---

## 7. SOC 2 / ISO 27001 + security (year one)

| Item | Year-one cost |
|------|---------------|
| Compliance automation platform (Vanta / Drata / Secureframe) | $7k – $25k |
| SOC 2 Type II auditor (Type I first, then Type II) | $12k – $30k |
| ISO 27001 certification body audit | $10k – $25k |
| Penetration test | $5k – $20k |
| vCISO / consultant (optional, if no in-house security lead) | $2k – $6k /mo |
| **Year-one total (excl. vCISO)** | **≈ $40k – $90k** |
| **Recurring thereafter** | **≈ $20k – $40k / yr** |

> ⏱ **Timeline note:** SOC 2 **Type II** requires an observation window (typically
> **3–12 months**). Start the controls + tooling early; certification follows the window.
> ISO 27001 similarly runs a Stage 1 + Stage 2 audit over a few months.

---

## 8. Ongoing people / ops

| | Tier A | Tier B |
|--|--------|--------|
| DevOps / SRE coverage | light — fractional, a few hrs/mo ($0–$2k/mo) | real coverage — fractional $2k–$6k/mo or a hire |
| On-call | optional | recommended |

People are frequently the **single largest real line item** once you're live.

---

## 9. Recommended path & first-year budget

Given **Africa residency + SOC 2/ISO are firm**, the destination is **Tier B (AWS af-south-1)**.
To avoid building twice, go cloud-native but keep it **right-sized for 50k**, and layer
compliance over a window rather than all at once.

**Phase 1 — Reliability foundation (now, ~2–4 wks):** HA database + PITR, ≥2 API
instances + load balancer, Cloudflare WAF, CI/CD + staging, monitoring + alerting, a job
queue. *Biggest reliability gain per dollar.* Can start on the managed stack for speed.

**Phase 2 — Cloud-native cutover (when procurement/scale demands, ~6–10 wks):** Terraform
on AWS af-south-1, ECS + RDS Multi-AZ + ElastiCache, migrate data, load-test, runbooks.

**Phase 3 — Compliance window (start in parallel with Phase 2):** Vanta/Drata, pen test,
SOC 2 Type I → Type II, ISO 27001. Budget the 3–12 month observation window.

**Phase 4 — Multi-region DR (only if a 99.99% SLA is contractually required).**

### Indicative year-one all-in (recommended Tier B path)
| Bucket | Year-one |
|--------|----------|
| Infra build-out / setup | $30k – $70k |
| Infra run-rate (~$2k–$3k/mo × 12) | $24k – $36k |
| SOC 2 + ISO + pen test | $40k – $90k |
| DevOps / SRE (~$2k–$6k/mo × 12) | $24k – $72k |
| **Subtotal (excl. variable comms & payments)** | **≈ $118k – $268k** |
| Variable comms (WhatsApp/SMS/USSD) + AI | usage-driven; $18k–$130k+/yr at volume |

> The headline: at 50k members, **servers are the small part**. Setup, compliance, people,
> and per-message comms are what move the budget — plan around those.

---

## 10. Decision summary

- **Run reliability now** on a hardened stack (Phase 1) — quick win, low cost.
- **Land on AWS af-south-1** (Tier B) for residency + SOC 2 fit — don't over-invest in EU managed.
- **Start the compliance window early** — it's gated by time, not money.
- **Engineer comms costs** (WhatsApp template type, local SMS routing) — the real scale lever.
- **Defer multi-region** until a contract demands 99.99%.
