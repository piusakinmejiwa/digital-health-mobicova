# MobiCova Health — Production infrastructure (AWS af-south-1)
# Phases 1–4 of PRODUCTION-DEPLOYMENT-RUNBOOK.md: network, data tier, registry,
# secrets, and the ECS Fargate + ALB compute tier.

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.60" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }

  # Recommended: store state in an encrypted, locked remote backend.
  # backend "s3" {
  #   bucket         = "mobicova-tfstate"
  #   key            = "prod/terraform.tfstate"
  #   region         = "af-south-1"
  #   dynamodb_table = "mobicova-tflock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.tags
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  name = "${var.project}-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, var.az_count)
  tags = merge({
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }, var.tags)

  # Keys held in the application secret (Secrets Manager). Values are set
  # out-of-band (console/CLI) — Terraform only creates the skeleton.
  secret_keys = [
    "DATABASE_URL", "DATABASE_CA_CERT", "JWT_SECRET",
    "ANTHROPIC_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
    "PAYSTACK_SECRET_KEY", "RESEND_API_KEY", "EMAIL_FROM",
    "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID",
    "PLATFORM_ADMIN_EMAILS", "CLIENT_URL", "SERVER_URL",
    "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET",
  ]

  database_url = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${var.db_name}?sslmode=require"
}
