# Phase 1 — Security groups (least privilege) and KMS keys.

resource "aws_security_group" "alb" {
  name_prefix = "${local.name}-alb-"
  description = "ALB — public ingress on 80/443"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTP (redirected to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags       = { Name = "${local.name}-alb-sg" }
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "ecs" {
  name_prefix = "${local.name}-ecs-"
  description = "ECS tasks — ingress only from the ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "App port from ALB"
    from_port       = var.api_container_port
    to_port         = var.api_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    description = "Outbound (DB, Redis, internet via NAT)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags       = { Name = "${local.name}-ecs-sg" }
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name}-rds-"
  description = "RDS — ingress only from ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
  tags       = { Name = "${local.name}-rds-sg" }
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "redis" {
  name_prefix = "${local.name}-redis-"
  description = "Redis — ingress only from ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
  tags       = { Name = "${local.name}-redis-sg" }
  lifecycle { create_before_destroy = true }
}

# ---- KMS keys (encryption at rest) ----
resource "aws_kms_key" "rds" {
  description             = "${local.name} RDS encryption"
  deletion_window_in_days = 14
  enable_key_rotation     = true
}
resource "aws_kms_alias" "rds" {
  name          = "alias/${local.name}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

resource "aws_kms_key" "s3" {
  description             = "${local.name} S3 encryption"
  deletion_window_in_days = 14
  enable_key_rotation     = true
}
resource "aws_kms_alias" "s3" {
  name          = "alias/${local.name}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

resource "aws_kms_key" "secrets" {
  description             = "${local.name} Secrets Manager encryption"
  deletion_window_in_days = 14
  enable_key_rotation     = true
}
resource "aws_kms_alias" "secrets" {
  name          = "alias/${local.name}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}
