# IAM credentials the NOBUS primary (outside AWS) uses to push to the DR buckets.
# A long-lived access key is unavoidable here because the source is off-AWS — it
# is scoped to ONLY the two DR buckets + the DR KMS key, nothing else. Configure
# it into wal-g / pgBackRest (WAL) and rclone/aws-cli (object sync) on Nobus.
# Treat the secret as sensitive; rotate after initial setup and periodically.

resource "aws_iam_user" "dr_writer" {
  count = local.dr_count
  name  = "${local.name}-dr-writer"
  tags  = { Name = "${local.name}-dr-writer", Purpose = "nobus-to-aws-dr-push" }
}

resource "aws_iam_access_key" "dr_writer" {
  count = local.dr_count
  user  = aws_iam_user.dr_writer[0].name
}

data "aws_iam_policy_document" "dr_writer" {
  count = local.dr_count

  statement {
    sid       = "ListDrBuckets"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [aws_s3_bucket.dr_wal[0].arn, aws_s3_bucket.dr_objects[0].arn]
  }
  statement {
    sid       = "WriteDrObjects"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.dr_wal[0].arn}/*", "${aws_s3_bucket.dr_objects[0].arn}/*"]
  }
  statement {
    sid       = "UseDrKey"
    actions   = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
    resources = [aws_kms_key.dr[0].arn]
  }
}

resource "aws_iam_user_policy" "dr_writer" {
  count  = local.dr_count
  name   = "${local.name}-dr-writer"
  user   = aws_iam_user.dr_writer[0].name
  policy = data.aws_iam_policy_document.dr_writer[0].json
}
