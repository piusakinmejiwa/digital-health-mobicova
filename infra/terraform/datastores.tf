# Phase 2 — Data tier: RDS PostgreSQL (Multi-AZ), ElastiCache Redis, S3.

# ---- RDS PostgreSQL (Multi-AZ) ----
resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.data[*].id
  tags       = { Name = "${local.name}-db-subnets" }
}

resource "aws_db_parameter_group" "main" {
  name   = "${local.name}-pg16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_instance" "main" {
  identifier     = "${local.name}-db"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  multi_az                = true
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  parameter_group_name    = aws_db_parameter_group.main.name
  backup_retention_period = var.db_backup_retention
  copy_tags_to_snapshot   = true

  performance_insights_enabled = true
  auto_minor_version_upgrade   = true
  deletion_protection          = true
  skip_final_snapshot          = false
  final_snapshot_identifier    = "${local.name}-db-final"
  apply_immediately            = false

  tags = { Name = "${local.name}-db" }
}

# ---- ElastiCache Redis (Multi-AZ) ----
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name}-redis"
  subnet_ids = aws_subnet.data[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${local.name}-redis"
  description          = "${local.name} cache, queue and sessions"

  engine             = "redis"
  engine_version     = var.redis_engine_version
  node_type          = var.redis_node_type
  num_cache_clusters = 2
  port               = 6379

  automatic_failover_enabled = true
  multi_az_enabled           = true

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true # connect with rediss://

  tags = { Name = "${local.name}-redis" }
}

# ---- S3 object storage (target for Supabase Storage migration) ----
resource "aws_s3_bucket" "storage" {
  bucket = "${local.name}-storage-${data.aws_caller_identity.current.account_id}"
  tags   = { Name = "${local.name}-storage" }
}

resource "aws_s3_bucket_public_access_block" "storage" {
  bucket                  = aws_s3_bucket.storage.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "storage" {
  bucket = aws_s3_bucket.storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}
