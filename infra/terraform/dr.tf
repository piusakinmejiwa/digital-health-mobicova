# =====================================================================
# Cross-region DISASTER RECOVERY — data tier
# =====================================================================
# Strategy: Pilot Light. Data replicates continuously to the DR region (RPO ≈
# seconds) while DR compute stays OFF until a region-loss event, when it's brought
# up per DR-RUNBOOK.md (RTO target ≈ 15–30 min). This file provisions the
# continuously-running half: a DR network for the replica, a DR KMS key, and an
# RDS cross-region read replica. S3 replication is in dr-storage.tf; the secret
# replica is in registry.tf.
#
# Everything here is gated on var.enable_dr, so the primary stack's plan is
# unchanged when DR is off. IMPORTANT: af-south-1 is AWS's only African region —
# the DR region is off-continent, so this replicates PHI across borders. Get DPO
# / AXA sign-off (NDPR) before enabling. All replicas are KMS-encrypted in transit
# and at rest.

# Second provider, pinned to the DR region.
provider "aws" {
  alias  = "dr"
  region = var.dr_region
  default_tags { tags = local.tags }
}

locals {
  dr_count = var.enable_dr ? 1 : 0
  dr_azs   = var.enable_dr ? slice(data.aws_availability_zones.dr.names, 0, 2) : []
}

data "aws_availability_zones" "dr" {
  provider = aws.dr
  state    = "available"
}

# ---- DR network (data tier only — the replica needs subnets + an SG) ----
resource "aws_vpc" "dr" {
  provider             = aws.dr
  count                = local.dr_count
  cidr_block           = var.dr_vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "${local.name}-dr-vpc" }
}

resource "aws_subnet" "dr_data" {
  provider          = aws.dr
  count             = var.enable_dr ? 2 : 0
  vpc_id            = aws_vpc.dr[0].id
  cidr_block        = cidrsubnet(var.dr_vpc_cidr, 8, count.index + 20)
  availability_zone = local.dr_azs[count.index]
  tags              = { Name = "${local.name}-dr-data-${local.dr_azs[count.index]}", Tier = "private-data" }
}

resource "aws_security_group" "dr_rds" {
  provider    = aws.dr
  count       = local.dr_count
  name_prefix = "${local.name}-dr-rds-"
  description = "DR RDS — ingress from within the DR VPC (tighten to the DR ECS SG when DR compute is added)"
  vpc_id      = aws_vpc.dr[0].id

  ingress {
    description = "PostgreSQL from inside the DR VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.dr_vpc_cidr]
  }
  tags       = { Name = "${local.name}-dr-rds-sg" }
  lifecycle { create_before_destroy = true }
}

resource "aws_db_subnet_group" "dr" {
  provider   = aws.dr
  count      = local.dr_count
  name       = "${local.name}-dr-db"
  subnet_ids = aws_subnet.dr_data[*].id
  tags       = { Name = "${local.name}-dr-db-subnets" }
}

# ---- DR KMS key (regional — required to encrypt the replica in the DR region) ----
resource "aws_kms_key" "rds_dr" {
  provider                = aws.dr
  count                   = local.dr_count
  description             = "${local.name} DR RDS encryption"
  deletion_window_in_days = 14
  enable_key_rotation     = true
}

resource "aws_kms_alias" "rds_dr" {
  provider      = aws.dr
  count         = local.dr_count
  name          = "alias/${local.name}-dr-rds"
  target_key_id = aws_kms_key.rds_dr[0].key_id
}

# ---- RDS cross-region read replica ----
# Continuously replicates from the primary (async). Promote it (drop the
# replicate_source_db link, via console/CLI per the runbook) to make it a
# standalone writable primary during a DR event.
resource "aws_db_instance" "replica" {
  provider = aws.dr
  count    = local.dr_count

  identifier          = "${local.name}-db-dr"
  replicate_source_db = aws_db_instance.main.arn # full ARN ⇒ cross-region
  instance_class      = var.dr_replica_instance_class

  # Encrypt the replica with the DR-region key. For an encrypted cross-region
  # replica, kms_key_id is what's required; storage_encrypted is inherited.
  kms_key_id = aws_kms_key.rds_dr[0].arn

  multi_az               = var.dr_replica_multi_az
  db_subnet_group_name   = aws_db_subnet_group.dr[0].name
  vpc_security_group_ids = [aws_security_group.dr_rds[0].id]

  # Retain backups so the replica can itself be promoted / become a source.
  backup_retention_period = var.db_backup_retention
  performance_insights_enabled = true
  auto_minor_version_upgrade   = true
  deletion_protection          = true
  skip_final_snapshot          = true # it's a replica; the primary holds the final snapshot

  tags = { Name = "${local.name}-db-dr" }
}
