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

  # Keys held in the application secret (Secrets Manager) and injected into the
  # task as env vars. Values are set out-of-band (console/CLI) — Terraform only
  # creates the skeleton. Reconciled against server/src/config/env.ts.
  # NOTE: pure-config toggles with safe defaults (OTP_DEV_MODE, AT_SANDBOX,
  # IMAGE_*, ANTHROPIC_MODEL, JWT_EXPIRES_IN, WHATSAPP_LANG) are intentionally
  # omitted — set those as plain `environment` in the task def only if overriding.
  secret_keys = [
    # Core
    "DATABASE_URL", "DATABASE_CA_CERT", "JWT_SECRET",
    "PLATFORM_ADMIN_EMAILS", "CLIENT_URL", "SERVER_URL",
    # AI
    "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
    # Payments
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "PAYSTACK_SECRET_KEY",
    # Email
    "RESEND_API_KEY", "EMAIL_FROM", "FEEDBACK_NOTIFY_EMAIL",
    # WhatsApp (Meta Cloud API) + Health-Tips template
    "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "WHATSAPP_TEMPLATE",
    # Supabase (claim docs + blog images; until migrated to S3)
    "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET", "SUPABASE_BLOG_BUCKET",
    # Daily.co video + consent-gated recording
    "DAILY_API_KEY", "DAILY_RECORDING_ENABLED", "DAILY_WEBHOOK_TOKEN",
    # Masked voice / SMS — Africa's Talking (+ Twilio fallback)
    "VOICE_PROVIDER",
    "AT_USERNAME", "AT_API_KEY", "AT_VOICE_NUMBER", "AT_WEBHOOK_TOKEN", "AT_SMS_SENDER",
    "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VOICE_NUMBER",
    # Nearest-pharmacy geocoding + Daily Health Tips scheduler
    "GEOCODE_API_KEY", "HEALTH_TIPS_CRON_SECRET",
  ]

  database_url = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${var.db_name}?sslmode=require"
}
