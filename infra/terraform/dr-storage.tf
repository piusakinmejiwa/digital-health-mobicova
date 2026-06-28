# =====================================================================
# Cross-region DR — S3 object replication (claim docs, blog/branding images)
# =====================================================================
# Continuously replicates the storage bucket to a DR-region bucket (KMS-encrypted
# both ends). Gated on var.enable_dr. The source bucket already has versioning +
# SSE-KMS (datastores.tf), which CRR requires.

# ---- DR-region KMS key + destination bucket ----
resource "aws_kms_key" "s3_dr" {
  provider                = aws.dr
  count                   = local.dr_count
  description             = "${local.name} DR S3 encryption"
  deletion_window_in_days = 14
  enable_key_rotation     = true
}

resource "aws_s3_bucket" "storage_dr" {
  provider = aws.dr
  count    = local.dr_count
  bucket   = "${local.name}-storage-dr-${data.aws_caller_identity.current.account_id}"
  tags     = { Name = "${local.name}-storage-dr" }
}

resource "aws_s3_bucket_public_access_block" "storage_dr" {
  provider                = aws.dr
  count                   = local.dr_count
  bucket                  = aws_s3_bucket.storage_dr[0].id
  block_public_acls       = true
  block_public_policy      = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "storage_dr" {
  provider = aws.dr
  count    = local.dr_count
  bucket   = aws_s3_bucket.storage_dr[0].id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage_dr" {
  provider = aws.dr
  count    = local.dr_count
  bucket   = aws_s3_bucket.storage_dr[0].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3_dr[0].arn
    }
    bucket_key_enabled = true
  }
}

# ---- Replication IAM role (S3 service assumes it; IAM is global) ----
data "aws_iam_policy_document" "s3_replication_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "s3_replication" {
  count              = local.dr_count
  name               = "${local.name}-s3-replication"
  assume_role_policy = data.aws_iam_policy_document.s3_replication_assume.json
}

data "aws_iam_policy_document" "s3_replication" {
  count = local.dr_count

  statement {
    sid       = "ReadSource"
    actions   = ["s3:GetReplicationConfiguration", "s3:ListBucket"]
    resources = [aws_s3_bucket.storage.arn]
  }
  statement {
    sid       = "ReadSourceObjects"
    actions   = ["s3:GetObjectVersionForReplication", "s3:GetObjectVersionAcl", "s3:GetObjectVersionTagging"]
    resources = ["${aws_s3_bucket.storage.arn}/*"]
  }
  statement {
    sid       = "WriteDestination"
    actions   = ["s3:ReplicateObject", "s3:ReplicateDelete", "s3:ReplicateTags"]
    resources = ["${aws_s3_bucket.storage_dr[0].arn}/*"]
  }
  statement {
    sid       = "DecryptSource"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.s3.arn]
  }
  statement {
    sid       = "EncryptDestination"
    actions   = ["kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.s3_dr[0].arn]
  }
}

resource "aws_iam_role_policy" "s3_replication" {
  count  = local.dr_count
  name   = "${local.name}-s3-replication"
  role   = aws_iam_role.s3_replication[0].id
  policy = data.aws_iam_policy_document.s3_replication[0].json
}

# ---- Replication rule on the SOURCE bucket ----
resource "aws_s3_bucket_replication_configuration" "storage" {
  count      = local.dr_count
  bucket     = aws_s3_bucket.storage.id
  role       = aws_iam_role.s3_replication[0].arn
  depends_on = [aws_s3_bucket_versioning.storage]

  rule {
    id       = "dr-replication"
    status   = "Enabled"
    priority = 0

    # v2 replication schema: an (empty = all objects) filter pairs with an
    # explicit delete-marker setting.
    filter {}
    delete_marker_replication { status = "Disabled" }

    # Source objects are SSE-KMS, so they must be explicitly opted in.
    source_selection_criteria {
      sse_kms_encrypted_objects { status = "Enabled" }
    }

    destination {
      bucket        = aws_s3_bucket.storage_dr[0].arn
      storage_class = "STANDARD"
      encryption_configuration {
        replica_kms_key_id = aws_kms_key.s3_dr[0].arn
      }
    }
  }
}
