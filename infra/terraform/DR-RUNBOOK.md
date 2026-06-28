# MobiCova Health — Cross-Region Disaster Recovery Runbook

How the platform survives the loss of an **entire AWS region** (af-south-1), not
just an Availability Zone (AZ-level failover is already automatic via RDS/Redis
Multi-AZ + ECS across AZs — see `PRODUCTION-DEPLOYMENT-RUNBOOK.md`).

> ⚠️ **Not yet applied.** This is Terraform + procedure. A DevOps engineer must
> `terraform plan` and review before `terraform apply` (Terraform isn't run in
> this repo). DR is gated on `enable_dr = true`; it's a no-op until then.

---

## 1. Strategy & objectives

**Pilot Light.** Data replicates to the DR region continuously; compute stays
**off** until a region-loss event, then is brought up. Best balance of cost vs
recovery for a single-anchor launch.

| Objective | Target | How |
|---|---|---|
| **RPO** (max data loss) | **≈ seconds** | RDS cross-region read replica (async) + S3 cross-region replication, both continuous |
| **RTO** (time to recover) | **≈ 15–30 min** | promote replica → bring up DR compute → flip DNS (steps below) |

Tiers above this (warm standby ≈ minutes RTO; active-active ≈ near-zero) cost
materially more to run and operate — revisit once volume / the AXA SLA justify it.

## 2. ⚠️ Data residency (NDPR) — read before enabling

**af-south-1 (Cape Town) is AWS's only African region.** The DR region is
therefore **off-continent** (`dr_region` default `eu-west-1`, Ireland; `me-south-1`
Bahrain is the nearest alternative). Enabling DR **replicates member PHI across
borders.** Before `enable_dr = true`:

- Get your **DPO + AXA's risk team** to sign off the cross-border transfer under
  NDPR (encryption + contractual safeguards are the basis).
- Everything is **KMS-encrypted at rest** (separate DR-region keys) and **in
  transit**. The replica/bucket are private (no public access).
- Record the decision in the compliance file.

## 3. What Terraform provisions (the always-on half)

Applied when `enable_dr = true`:

- **DR network** — a minimal VPC + data subnets + SG in `dr_region` for the replica.
- **RDS cross-region read replica** (`aws_db_instance.replica`) — async copy of prod, KMS-encrypted with a DR-region key.
- **S3 cross-region replication** — `…-storage-dr` bucket + replication rule on the source bucket (claim docs, blog/branding images).
- **Secrets Manager replica** — the app secret mirrored to `dr_region` so DR compute can read config.

Outputs: `dr_rds_replica_endpoint`, `dr_storage_bucket`, `dr_region`.

## 4. What is NOT yet automated (bring up during failover)

To keep idle cost near zero (pilot light), the **DR compute** is not running:

- DR **ALB + ECS service + Redis** in `dr_region`.
- DNS **failover** (Cloudflare Load Balancer origin pools, or Route 53).

Two options to be ready:
- **(Recommended) Phase B:** add a parametrised `dr-compute.tf` (ALB+ECS+Redis mirror, `desired_count` default 0). Then failover = scale it up — fastest, fully codified. *Ask and this gets built next.*
- **Manual:** stand up the DR ALB/ECS from the console during the incident using the replicated image (ECR is regional — also replicate the image, or push to a DR ECR) and the replicated secret.

## 5. 🚨 Failover procedure (region loss)

**Declare a DR event only when af-south-1 is genuinely unavailable** (AWS Health
Dashboard + your own probes red for >N min). Promotion is one-way-ish — don't do
it for a brief blip.

1. **Communicate.** Post to the status page; notify AXA per the SLA.
2. **Promote the replica** to a standalone primary (DR region):
   ```bash
   aws rds promote-read-replica --db-instance-identifier mobicova-prod-db-dr --region <dr_region>
   aws rds wait db-instance-available --db-instance-identifier mobicova-prod-db-dr --region <dr_region>
   ```
3. **Point config at the promoted DB.** Update `DATABASE_URL` in the **DR-region**
   secret to the promoted endpoint (`dr_rds_replica_endpoint`).
4. **Bring up DR compute** (Phase B: `terraform apply` with `dr_desired_count >= 2`;
   or stand up ALB/ECS manually). Confirm `/healthz` 200 and `/readyz` 200 on the
   DR ALB.
5. **Run the migration check** against the promoted DB — `npm run migrate:status`
   (or check `/health` `migrations.ok`) so the schema matches the code.
6. **Flip DNS** to the DR ALB:
   - **Cloudflare LB** (recommended, matches current edge): mark the primary origin
     pool unhealthy / disabled so traffic fails to the DR pool. (Pre-create the LB
     with primary + DR pools + health checks so this is automatic.)
   - or Route 53 failover record → DR ALB.
7. **Verify** end-to-end: login, a member read (PHI gate), a claim action.
8. **Point object storage** at the DR bucket (`S3_BUCKET` in the DR secret) if not
   already.

## 6. Failback (af-south-1 restored)

1. Rebuild the primary DB from the DR primary (create a new cross-region replica
   **back** into af-south-1, let it catch up).
2. Schedule a short maintenance window; stop writes.
3. Promote the af-south-1 replica; repoint config; flip DNS back.
4. Re-establish af-south-1 → DR replication (re-apply the normal DR topology).

## 7. Test it (or it doesn't exist)

- **Game day every quarter**: promote the replica into an *isolated* test, bring
  up DR compute, run the smoke-test sheet, measure actual RTO/RPO, tear down.
- Never let the first real promotion be the first time anyone's done it.

## 8. Rough monthly cost of the always-on DR half

- Cross-region read replica (same class as prod): ≈ the prod DB instance cost again.
- S3 replication: storage in DR + cross-region transfer (small for documents).
- Secret replica: negligible.
- DR compute: **₦0 while pilot-light** (off); only billed when brought up.

So DR roughly adds *one DB instance + a little storage/transfer* to the bill —
far less than a full warm-standby's idle 2× compute.

---

*Terraform: `dr.tf`, `dr-storage.tf`, the `replica` block in `registry.tf`, and
the `dr_*` variables/outputs. All gated on `enable_dr`.*
