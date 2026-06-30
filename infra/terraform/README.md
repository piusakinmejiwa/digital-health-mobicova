# Terraform — MobiCova Health production (AWS af-south-1)

Provisions **Phases 1–4** of `PRODUCTION-DEPLOYMENT-RUNBOOK.md`:

- **Phase 1** — VPC (2 AZs, public/private-app/private-data), NAT, security groups, KMS, ECR, Secrets Manager (`vpc.tf`, `security.tf`, `registry.tf`)
- **Phase 2** — RDS PostgreSQL Multi-AZ, ElastiCache Redis, S3 (`datastores.tf`)
- **Phase 4** — ALB + ECS Fargate (≥2 tasks) + autoscaling (`compute.tf`)

> Phase 3 (the container image) is built from `server/Dockerfile` and pushed to the ECR
> repo this stack creates.

## Prerequisites
- Terraform ≥ 1.6, AWS CLI configured with admin credentials.
- **Enable the af-south-1 region** on the account (it's opt-in).
- (For HTTPS) an **ACM certificate** for `api.<yourdomain>` in af-south-1.

## Apply order (two passes, because compute needs an image)

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # edit values
terraform init

# Pass 1 — network, data, registry, secrets (no image yet)
terraform apply \
  -target=aws_vpc.main -target=aws_ecr_repository.api \
  -target=aws_db_instance.main -target=aws_elasticache_replication_group.redis \
  -target=aws_s3_bucket.storage -target=aws_secretsmanager_secret_version.app

# Build & push the API image to the new ECR repo (see server/Dockerfile)
#   docker build -t <ecr_url>:<sha> ./server && docker push <ecr_url>:<sha>

# Pass 2 — set api_image to the pushed URI, then apply everything
terraform apply        # creates ALB + ECS service
```

## Before first deploy
1. Open the app secret (`app_secret_arn` output) in Secrets Manager and replace every
   `REPLACE_ME` with the **live** value (Stripe/Paystack/WhatsApp/Anthropic/Resend, etc.).
   `DATABASE_URL` and `JWT_SECRET` are pre-filled. **Never** add `OTP_DEV_MODE` or
   `DEMO_SEED_PASSWORD`.
2. Add `DATABASE_CA_CERT` (the RDS CA PEM) so the app verifies the DB TLS cert.
3. Run migrations once (a one-off ECS task with command `node dist/db/migrate.js`, or via
   the production workflow).

## Notes & caveats
- `random_password` for the DB lands in Terraform **state** — use the encrypted S3 backend
  (commented in `main.tf`) and restrict access. Rotate post-launch.
- The ECS service uses `ignore_changes = [task_definition, desired_count]` so CI/CD owns
  image rollouts and autoscaling owns the count — Terraform won't fight them.
- Data subnets are **isolated** (no NAT). RDS/Redis need no egress.
- Destroying RDS is blocked by `deletion_protection` and takes a final snapshot.

## Key outputs
`ecr_repository_url`, `alb_dns_name`, `rds_endpoint`, `redis_primary_endpoint`,
`s3_storage_bucket`, `app_secret_arn`, `ecs_cluster_name`, `ecs_service_name`,
`ecs_task_family` — feed these into Cloudflare DNS and the production workflow secrets.

## Hybrid disaster recovery — Nobus primary → AWS DR (optional)
**Production primary now hosts on Nobus (Nigeria) for data residency.** This AWS
stack serves as the **DR site only**. Set `enable_dr = true` to provision the
always-on, low-cost DR foundation (`dr.tf`, `dr-iam.tf`): encrypted S3 buckets that
the Nobus primary continuously pushes to — PostgreSQL WAL + base backups (wal-g /
pgBackRest) and an object-store copy — plus a scoped IAM user for the Nobus side.
The DR database (Postgres-on-EC2 standby) and app compute are **pilot-light** — stood
up on a real disaster. Off by default.

Read **`DR-RUNBOOK.md`** first — it covers the strategy, **RTO/RPO**, the **NDPR
cross-border sign-off** (DR places encrypted PHI abroad), the replication setup from
Nobus, the failover/failback procedure, and a **full monthly cost breakdown**
(pilot-light ≈ $10–15/mo; warm-standby add-on ≈ $170/mo).

Note: the AZ-level managed services in this stack (RDS/ElastiCache/ECS) describe the
earlier AWS-primary reference design; under the Nobus-primary model the AWS DB tier
is self-managed Postgres-on-EC2 (to receive external WAL) — see the runbook.
