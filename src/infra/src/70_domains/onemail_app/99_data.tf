data "aws_sqs_queue" "high_priority" {
  name = "${local.project_nodomain}-sqs-high-priority"
}

data "aws_sqs_queue" "low_priority" {
  name = "${local.project_nodomain}-sqs-low-priority"
}

data "aws_vpc_endpoint" "dynamodb" {
  service_name = "com.amazonaws.eu-south-1.dynamodb"
}

data "aws_vpc_endpoint" "api_gtw" {
  service_name = "com.amazonaws.eu-south-1.execute-api"
  vpc_id       = data.aws_vpc.core.id
}

data "aws_acm_certificate" "api_custom_domain" {
  domain      = local.zone_name
  statuses    = ["ISSUED"]
  most_recent = true
}

data "aws_lb" "nlb" {
  name = "${local.project_nodomain}-elb"
}

data "aws_dynamodb_table" "EmailStatusHistory" {
  name = "EmailStatusHistory"
}

data "aws_ecs_cluster" "core" {
  cluster_name = "${local.project_nodomain}-ecs-cluster"
}

data "aws_vpc" "core" {
  filter {
    name   = "tag:Name"
    values = ["${local.project_nodomain}-vpc"]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.core.id]
  }

  filter {
    name   = "tag:Name"
    values = ["${local.project_nodomain}-vpc-private-*"]
  }
}

data "aws_ecr_repository" "ecs_service" {
  name = "${local.project_nodomain}-ecr-${var.ecs_service_image_name}"
}

data "aws_route53_zone" "onemail" {
  name         = local.zone_name
  private_zone = false
}

data "aws_ses_domain_identity" "onemail" {
  count  = var.enable_ses ? 1 : 0
  domain = local.zone_name
}


data "aws_lb_listener" "ecs_core" {
  load_balancer_arn = data.aws_lb.nlb.arn
  port              = 3000
}
