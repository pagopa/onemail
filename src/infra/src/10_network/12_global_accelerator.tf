resource "aws_globalaccelerator_accelerator" "this" {
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
  accelerator_arn = aws_globalaccelerator_accelerator.this.id
  protocol        = "TCP"

  port_range {
    from_port = 443
    to_port   = 443
  }
}

resource "aws_globalaccelerator_endpoint_group" "alb" {
  listener_arn = aws_globalaccelerator_listener.https.id

  endpoint_configuration {
    endpoint_id = module.alb.arn
    weight      = 100
  }
}
