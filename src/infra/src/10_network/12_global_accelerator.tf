resource "aws_globalaccelerator_accelerator" "this" {
  count = var.create_primary_region_public_entrypoint ? 1 : 0

  name            = "${local.project}-ga"
  enabled         = true
  ip_address_type = "IPV4"

  #   attributes {
  #     flow_logs_enabled   = true
  #     flow_logs_s3_bucket = aws_s3_bucket.edge_logs.id
  #     flow_logs_s3_prefix = "ga"
  #   }

  tags = module.tag_config.tags
}

resource "aws_globalaccelerator_listener" "https" {
  count = var.create_primary_region_public_entrypoint ? 1 : 0

  accelerator_arn = aws_globalaccelerator_accelerator.this[0].id
  protocol        = "TCP"

  port_range {
    from_port = 443
    to_port   = 443
  }
}

resource "aws_globalaccelerator_endpoint_group" "alb" {
  count = var.create_primary_region_public_entrypoint ? 1 : 0

  listener_arn          = aws_globalaccelerator_listener.https[0].id
  endpoint_group_region = var.aws_region

  endpoint_configuration {
    endpoint_id = module.alb.arn
    weight      = 100
  }
}

resource "aws_globalaccelerator_endpoint_group" "secondary_alb" {
  count = var.create_primary_region_public_entrypoint && length(try(data.aws_lbs.secondary_alb[0].arns, [])) > 0 ? 1 : 0

  listener_arn          = aws_globalaccelerator_listener.https[0].id
  endpoint_group_region = var.secondary_aws_region

  endpoint_configuration {
    endpoint_id = tolist(data.aws_lbs.secondary_alb[0].arns)[0]
    weight      = 100
  }
}
