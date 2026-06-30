# =====================================================================
# CROSS-CLOUD DISASTER RECOVERY — AWS receiving site for a Nobus primary
# =====================================================================
# Primary hosting is Nobus (Nigeria): self-managed PostgreSQL, Redis, object
# storage and the app — all in-country for residency. AWS is the DR site ONLY.
#
# This file provisions the ALWAYS-ON, low-cost DR foundation: encrypted S3
# buckets that the Nobus primary continuously pushes to —
#   • PostgreSQL WAL + base backups (via wal-g / pgBackRest) → point-in-time DR
#   • a copy of the object store (claim docs / images)
# plus the KMS key protecting them. The IAM credentials the Nobus side uses to
# push are in dr-iam.tf. The DR COMPUTE and a Postgres-on-EC2 standby are
# PILOT-LIGHT — stood up on a real disaster per DR-RUNBOOK.md (so they cost ~₦0
# until invoked).
#
# Region: the default AWS provider's region (var.aws_region, default af-south-1)
# IS the DR region. Everything here is gated on var.enable_dr.
#
# ⚠️ DR places ENCRYPTED PHI outside Nigeria. Requires AXA / DPO sign-off + SCCs.

locals {
  dr_count = var.enable_dr ? 1 : 0
}

# ---- KMS key for the DR buckets ----
resource "aws_kms_key" "dr" {
  count                   = local.dr_count
  description             = "${local.name} DR encryption (WAL archive + object copy)"
  deletion_window_in_days = 14
  enable_key_rotation     = true
}

resource "aws_kms_alias" "dr" {
  count         = local.dr_count
  name          = "alias/${local.name}-dr"
  target_key_id = aws_kms_key.dr[0].key_id
}

# ---- PostgreSQL WAL + base-backup archive (enables PITR restore on AWS) ----
resource "aws_s3_bucket" "dr_wal" {
  count  = local.dr_count
  bucket = "${local.name}-dr-walarchive-${data.aws_caller_identity.current.account_id}"
  tags   = { Name = "${local.name}-dr-walarchive" }
}

resource "aws_s3_bucket_public_access_block" "dr_wal" {
  count                   = local.dr_count
  bucket                  = aws_s3_bucket.dr_wal[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "dr_wal" {
  count  = local.dr_count
  bucket = aws_s3_bucket.dr_wal[0].id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "dr_wal" {
  count  = local.dr_count
  bucket = aws_s3_bucket.dr_wal[0].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.dr[0].arn
    }
    bucket_key_enabled = true
  }
}

# Expire WAL beyond the recovery window so the archive doesn't grow forever.
resource "aws_s3_bucket_lifecycle_configuration" "dr_wal" {
  count  = local.dr_count
  bucket = aws_s3_bucket.dr_wal[0].id
  rule {
    id     = "expire-old-wal"
    status = "Enabled"
    filter {}
    expiration { days = var.wal_retention_days }
    noncurrent_version_expiration { noncurrent_days = 7 }
  }
}

# ---- DR copy of the object store (claim docs / images synced from Nobus) ----
resource "aws_s3_bucket" "dr_objects" {
  count  = local.dr_count
  bucket = "${local.name}-dr-objects-${data.aws_caller_identity.current.account_id}"
  tags   = { Name = "${local.name}-dr-objects" }
}

resource "aws_s3_bucket_public_access_block" "dr_objects" {
  count                   = local.dr_count
  bucket                  = aws_s3_bucket.dr_objects[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "dr_objects" {
  count  = local.dr_count
  bucket = aws_s3_bucket.dr_objects[0].id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "dr_objects" {
  count  = local.dr_count
  bucket = aws_s3_bucket.dr_objects[0].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.dr[0].arn
    }
    bucket_key_enabled = true
  }
}
