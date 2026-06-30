variable "aws_region" {
  description = "AWS region (af-south-1 is opt-in — enable it on the account first)."
  type        = string
  default     = "af-south-1"
}

variable "project" {
  type    = string
  default = "mobicova"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "tags" {
  description = "Extra tags applied to every resource."
  type        = map(string)
  default     = {}
}

# ---- Network ----
variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones (HA needs >= 2)."
  type        = number
  default     = 2
}

# ---- API (ECS Fargate) ----
variable "api_image" {
  description = "Full ECR image URI:tag for the API. Push an image before the first apply, or apply network/data first then compute."
  type        = string
}

variable "api_container_port" {
  type    = number
  default = 8080
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "api_min_count" {
  type    = number
  default = 2
}

variable "api_max_count" {
  type    = number
  default = 6
}

# ---- Database (RDS PostgreSQL) ----
variable "db_engine_version" {
  type    = string
  default = "16.4"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage" {
  type    = number
  default = 100
}

variable "db_name" {
  type    = string
  default = "mobicova"
}

variable "db_username" {
  type    = string
  default = "mobicova_admin"
}

variable "db_backup_retention" {
  description = "Days of automated backups / PITR window."
  type        = number
  default     = 7
}

# ---- Redis (ElastiCache) ----
variable "redis_engine_version" {
  type    = string
  default = "7.1"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.small"
}

# ---- Edge / TLS ----
variable "acm_certificate_arn" {
  description = "ACM cert ARN for the API domain (af-south-1). Leave empty to expose HTTP only (testing)."
  type        = string
  default     = ""
}

# ---- Disaster recovery (AWS DR site for a Nobus primary) ----
# Primary hosting is Nobus (Nigeria). AWS is the DR site (this stack's region,
# var.aws_region). enable_dr provisions the always-on DR foundation: WAL-archive +
# object-copy S3 buckets + the IAM user the Nobus side uses to push. DR compute is
# pilot-light, brought up on a real disaster per DR-RUNBOOK.md. WARNING: DR places
# encrypted PHI abroad -> AXA / DPO sign-off + SCCs required.
variable "enable_dr" {
  description = "Provision the AWS DR foundation (WAL-archive + object S3 buckets + the Nobus push IAM user). Off by default."
  type        = bool
  default     = false
}

variable "wal_retention_days" {
  description = "Days of PostgreSQL WAL / base-backup history kept in the DR archive (your PITR window)."
  type        = number
  default     = 14
}
