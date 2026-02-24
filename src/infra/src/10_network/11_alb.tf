# resource "aws_s3_bucket" "edge_logs" {
#   bucket = var.edge_logs_bucket
#   tags   = module.tag_config.tags
# }

# resource "aws_s3_bucket_public_access_block" "edge_logs" {
#   bucket                  = aws_s3_bucket.edge_logs.id
#   block_public_acls       = true
#   block_public_policy     = true
#   ignore_public_acls      = true
#   restrict_public_buckets = true
# }

# resource "aws_s3_bucket_server_side_encryption_configuration" "edge_logs" {
#   bucket = aws_s3_bucket.edge_logs.id
#   rule {
#     apply_server_side_encryption_by_default {
#       sse_algorithm = "AES256"
#     }
#   }
# }

# data "aws_iam_policy_document" "alb_logs_bucket_policy" {
#   statement {
#     sid = "AWSLogDeliveryWrite"
#     principals {
#       type        = "AWS"
#       identifiers = [data.aws_elb_service_account.this.arn]
#     }
#     actions   = ["s3:PutObject"]
#     resources = ["${aws_s3_bucket.edge_logs.arn}/alb/*"]
#   }
# }

# resource "aws_s3_bucket_policy" "edge_logs" {
#   bucket = aws_s3_bucket.edge_logs.id
#   policy = data.aws_iam_policy_document.alb_logs_bucket_policy.json
# }

resource "aws_security_group" "alb" {
  name_prefix = "${local.project}-alb-sg"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTPS from internet (fronted by Global Accelerator)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description     = "To ECS proxy only"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_proxy.id]
  }

  tags = module.tag_config.tags
}

module "acm" {
  source  = "terraform-aws-modules/acm/aws"
  version = "5.0.0"

  domain_name = local.zone_name

  zone_id = module.zone.route53_zone_zone_id[local.zone_name]

  validation_method      = "DNS"
  create_route53_records = true

  tags = {
    Name = local.zone_name
  }
}

module "alb" {
  source  = "terraform-aws-modules/alb/aws"
  version = "9.12.0"

  name               = "${local.project}-alb"
  load_balancer_type = "application"
  internal           = false
  vpc_id             = module.vpc.vpc_id
  subnets            = module.vpc.public_subnets
  security_groups    = [aws_security_group.alb.id]

  enable_deletion_protection = true
  drop_invalid_header_fields = true

  #   access_logs = {
  #     bucket  = aws_s3_bucket.edge_logs.id
  #     prefix  = "alb"
  #     enabled = true
  #   }

  listeners = {
    https = {
      port            = 443
      protocol        = "HTTPS"
      certificate_arn = module.acm.certificate_arn
      forward = {
        target_group_key = "proxy"
      }
    }
  }

  target_groups = {
    proxy = {
      protocol    = "HTTP"
      port        = 8080
      target_type = "ip"
      health_check = {
        protocol = "HTTP"
        path     = "/health"
      }
    }
  }

  tags = module.tag_config.tags
}

resource "aws_wafv2_web_acl" "alb_waf" {
  name        = var.web_acl.name
  description = "ALB WAF."
  scope       = "REGIONAL"

  visibility_config {
    cloudwatch_metrics_enabled = var.web_acl.cloudwatch_metrics_enabled
    metric_name                = "${local.project}-alb-waf"
    sampled_requests_enabled   = var.web_acl.sampled_requests_enabled
  }
  default_action {
    allow {}
  }


  dynamic "rule" {
    for_each = { for r in local.web_acl_rules : r.name => r }
    content {
      name     = rule.value.name
      priority = rule.value.priority

      override_action {
        count {}
      }

      statement {
        managed_rule_group_statement {
          name        = rule.value.managed_rule_group_name
          vendor_name = rule.value.vendor_name
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = var.web_acl.cloudwatch_metrics_enabled
        metric_name                = rule.value.metric_name
        sampled_requests_enabled   = var.web_acl.sampled_requests_enabled
      }
    }
  }

  tags = { Name = "${local.project}-alb-waf" }
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = module.alb.arn
  web_acl_arn  = aws_wafv2_web_acl.alb_waf.arn
}
