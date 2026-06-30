# MobiCova Health — Hybrid Disaster Recovery Runbook (Nobus primary → AWS DR)

How the platform recovers if the **Nobus (Nigeria) primary** is lost. Primary
hosting + all live PHI stay in Nigeria on Nobus; **AWS (af-south-1) is the DR
site only**. Within Nobus, the primary should itself run a local standby for
node/rack failure — this runbook covers the bigger event: losing the Nobus site.

> ⚠️ **Not yet applied.** Terraform here is reviewed/applied by DevOps (`terraform
> plan` first — it is not run in this repo). DR is gated on `enable_dr = true`.

---

## 1. Strategy & objectives

**Pilot Light, cross-cloud.** Data replicates continuously from Nobus to AWS
(RPO ≈ minutes); AWS compute + the standby database stay **off** until a real
disaster, then are brought up (RTO target ≈ 30–45 min).

| Objective | Target | Mechanism |
|---|---|---|
| **RPO** | ≈ minutes | Continuous WAL shipping (wal-g) + frequent object sync to AWS S3 |
| **RTO** | ≈ 30–45 min (pilot light) · ≈ 10–15 min (warm standby) | Restore/promote Postgres on AWS, bring up compute, flip DNS |

## 2. ⚠️ Residency / NDPR — sign-off required

DR places **encrypted PHI outside Nigeria** (AWS af-south-1). This is a deliberate
exception to the in-Nigeria rule, valid only with **AXA + DPO sign-off and SCCs**.
Mitigations in place: KMS encryption at rest (AWS-side key), TLS in transit, private
buckets, DR data used only for recovery. Record the approval in the compliance file.

## 3. Architecture

```
 NIGERIA — Nobus (primary, all live PHI)          AWS af-south-1 (DR — pilot light)
   Postgres primary (+ local standby)             S3: WAL archive  (always on)
      |  wal-g  --- encrypted WAL/base backups -->  S3: object copy (always on)
   Object store --- rclone sync ----------------->        |
   Redis, app containers, load balancer            (on disaster, brought up:)
                                                    Postgres-on-EC2 restored from WAL
                                                    ECS/EC2 app + ALB
        \________ Cloudflare LB (health-checked failover) ________/
                 primary origin = Nobus  ·  DR origin = AWS
```

**Always on (cheap):** the two S3 buckets + KMS + the push IAM user (Terraform).
**Pilot light (≈₦0 until invoked):** the AWS Postgres-on-EC2 standby + app compute
+ ALB — stood up on failover.

## 4. What Terraform provisions (`enable_dr = true`)

- `aws_s3_bucket.dr_wal` — receives Postgres WAL + base backups (wal-g/pgBackRest).
- `aws_s3_bucket.dr_objects` — receives the object-store sync.
- `aws_kms_key.dr` — encrypts both, in the DR region.
- `aws_iam_user.dr_writer` (+ access key) — scoped push credentials for the Nobus side.

Outputs: `dr_wal_archive_bucket`, `dr_objects_bucket`, `dr_writer_access_key_id`,
`dr_writer_secret_access_key` (sensitive), `dr_region`.

## 5. Set up replication FROM Nobus (one-time, DevOps)

1. On the Nobus Postgres primary, install **wal-g** (or pgBackRest). Point it at
   `dr_wal_archive_bucket` using the `dr_writer` access key + the DR KMS key.
   Configure `archive_command` for continuous WAL push + a daily base backup.
2. Install **rclone** (or aws-cli `s3 sync` on a cron) to sync the object store to
   `dr_objects_bucket` every few minutes.
3. Verify: WAL segments and a base backup appear in the WAL bucket; objects appear
   in the object bucket. Run `wal-g backup-list` to confirm.

## 6. 🚨 Failover (Nobus site loss)

Declare only when Nobus is genuinely unavailable (their status + your probes red
for >N min). It's a one-way move — don't trigger on a brief blip.

1. **Communicate** — status page; notify AXA per the SLA.
2. **Stand up the DR database on AWS:** launch the Postgres-on-EC2 standby (or
   `terraform apply` the DR compute), then `wal-g backup-fetch LATEST` + replay WAL
   to the latest point. Promote it to read-write.
3. **Bring up DR compute** (ECS/EC2 + ALB). Point `DATABASE_URL` at the recovered
   DB and `S3_BUCKET` at `dr_objects_bucket`. Confirm `/healthz` + `/readyz` = 200.
4. **Schema check** — `npm run migrate:status` (or `/health` `migrations.ok`).
5. **Flip DNS** — in Cloudflare LB, disable the Nobus origin pool so traffic fails
   to the AWS pool. (Pre-create the LB with both pools + health checks so this is
   near-automatic.)
6. **Verify** end-to-end: login, a member read (PHI gate), a claim action, USSD.

## 7. Failback (Nobus restored)

1. Rebuild the Nobus primary; seed it from the AWS DB (logical dump or fresh
   base-backup), then re-establish wal-g shipping AWS→Nobus to catch up.
2. Short maintenance window; stop writes; cut DNS back to the Nobus origin.
3. Re-point wal-g/rclone to resume normal Nobus→AWS DR shipping.

## 8. Test it — quarterly game day

Bring up the AWS DR in an isolated test from the live archive, run the smoke-test
sheet, measure real RTO/RPO, tear down. Never let the first promotion be the real one.

## 9. Costing (indicative — USD, AWS af-south-1, ~mid-2026; assume ₦1,600/$)

**AWS DR — always-on (Pilot Light foundation):** only S3 + KMS run 24/7.

| Item | Est. / month |
|---|---|
| S3 storage — WAL archive + object copy (~150–250 GB) | $5–8 |
| S3 requests (WAL PUTs, base backups) | <$1 |
| Data transfer INTO AWS (ingress) | $0 (free) |
| KMS (key + requests) | $2–3 |
| IAM user | $0 |
| **Pilot-light AWS subtotal** | **≈ $10–15 /mo (~₦16k–24k)** |

**AWS DR — only billed DURING a failover** (₦0 steady-state):

| Item | While invoked |
|---|---|
| EC2 Postgres standby (e.g. m6i.large) | ~$0.14/hr |
| App compute (ECS/EC2) + ALB | ~$0.10–0.15/hr |
| → a multi-day failover | ~$15–25/day |

**Optional — Warm Standby (lower RTO, runs 24/7):** add a running standby DB +
minimal app.

| Item | Est. / month |
|---|---|
| EC2 Postgres standby (m6i.large) + 100 GB gp3 | $110–130 |
| Minimal app instance + ALB | $40–60 |
| **Warm-standby add-on** | **≈ $160–190 /mo (~₦256k–304k)** |

**Nobus primary (rough — confirm via the due-diligence questionnaire):** their site
quotes pay-as-you-go from ₦9,309/mo entry; a production setup (2–4 app VMs +
Postgres primary+standby + Redis + storage + LB) is plausibly **₦250k–₦900k/mo
($150–$560)** depending on sizing. **Treat as a placeholder until Nobus quotes.**
Also budget **Nobus egress** for the continuous WAL/object stream out to AWS —
ask Nobus for their bandwidth pricing.

**Bottom line:** keeping DR *ready* costs roughly **$10–15/mo** (pilot light); you
only pay real DR compute **when you actually fail over**. Warm standby (~$170/mo)
buys a faster RTO if AXA's SLA demands it. Recommendation: **launch pilot-light**,
upgrade to warm standby only if the contracted RTO requires it.

---

*Terraform: `dr.tf`, `dr-iam.tf`, the `enable_dr` / `wal_retention_days` variables,
and the `dr_*` outputs. Cross-cloud — the AWS side is DR only; the Nobus primary is
provisioned separately.*
