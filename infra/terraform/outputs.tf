output "ecr_repository_url" {
  description = "Push the API image here."
  value       = aws_ecr_repository.api.repository_url
}

output "alb_dns_name" {
  description = "Point api.<domain> at this (CNAME) in Cloudflare."
  value       = aws_lb.main.dns_name
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "redis_primary_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "s3_storage_bucket" {
  value = aws_s3_bucket.storage.bucket
}

output "app_secret_arn" {
  description = "Set live env values on this secret (JSON keys) before first deploy."
  value       = aws_secretsmanager_secret.app.arn
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.api.name
}

output "ecs_task_family" {
  value = aws_ecs_task_definition.api.family
}

# ---- DR (null unless enable_dr = true) ----
output "dr_wal_archive_bucket" {
  description = "S3 bucket the Nobus primary ships PostgreSQL WAL + base backups to (wal-g/pgBackRest)."
  value       = var.enable_dr ? aws_s3_bucket.dr_wal[0].bucket : null
}

output "dr_objects_bucket" {
  description = "S3 bucket the Nobus primary syncs object storage (claim docs/images) to."
  value       = var.enable_dr ? aws_s3_bucket.dr_objects[0].bucket : null
}

output "dr_writer_access_key_id" {
  description = "Access key id for the Nobus push IAM user. Configure into wal-g + rclone on Nobus."
  value       = var.enable_dr ? aws_iam_access_key.dr_writer[0].id : null
}

output "dr_writer_secret_access_key" {
  description = "Secret key for the Nobus push IAM user — sensitive; rotate after setup."
  value       = var.enable_dr ? aws_iam_access_key.dr_writer[0].secret : null
  sensitive   = true
}

output "dr_region" {
  description = "AWS DR region (this stack's region)."
  value       = var.enable_dr ? var.aws_region : null
}
