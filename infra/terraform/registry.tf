# Phase 1 — ECR repository + Secrets Manager skeleton.

resource "aws_ecr_repository" "api" {
  name                 = "${local.name}-api"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "AES256"
  }
  tags = { Name = "${local.name}-api" }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 20 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }
      action       = { type = "expire" }
    }]
  })
}

# ---- Application secret (JSON of env vars) ----
# Terraform creates the skeleton with the DB URL + a generated JWT secret.
# Set every other key (live API keys, etc.) out-of-band; Terraform won't revert
# them (ignore_changes on secret_string).
resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name        = "${local.name}/app"
  description = "${local.name} application environment (live values set out-of-band)"
  kms_key_id  = aws_kms_key.secrets.arn
  # DR is a single AWS region (no second-region replica needed): this secret already
  # lives in the DR region, read by the DR compute when it's brought up on failover.
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(merge(
    { for k in local.secret_keys : k => "REPLACE_ME" },
    {
      DATABASE_URL = local.database_url
      JWT_SECRET   = random_password.jwt.result
    }
  ))

  lifecycle {
    ignore_changes = [secret_string]
  }
}
