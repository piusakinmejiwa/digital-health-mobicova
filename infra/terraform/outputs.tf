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
output "dr_rds_replica_endpoint" {
  description = "Cross-region read replica endpoint. Promote this on a region-loss event (see DR-RUNBOOK.md)."
  value       = var.enable_dr ? aws_db_instance.replica[0].address : null
}

output "dr_storage_bucket" {
  description = "DR-region replica of the object-storage bucket."
  value       = var.enable_dr ? aws_s3_bucket.storage_dr[0].bucket : null
}

output "dr_region" {
  value = var.enable_dr ? var.dr_region : null
}
