locals {
  api_gateway_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = "*",
        Action    = "execute-api:Invoke",
        Resource  = "${module.api_gateway.rest_api_execution_arn}/*"
      },
      {
        Effect    = "Deny",
        Principal = "*",
        Action    = "execute-api:Invoke",
        Resource  = "${module.api_gateway.rest_api_execution_arn}/*",
        Condition = {
          StringNotEquals = {
            "aws:sourceVpce" : data.aws_vpc_endpoint.api_gtw.id
          }
        }
      }
    ]
  })
}

module "api_gateway" {
  source             = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/api_gateway?ref=main"
  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"
  name               = "${local.project_nodomain}-api-gateway"
  body = templatefile("${path.module}/${var.openapi_template_file}", {
    connection_id           = aws_api_gateway_vpc_link.apigw.id
    env                     = var.env
    server_url              = local.zone_name
    tenant_request_template = jsonencode(local.api_gateway_tenant_request_template)
    uri                     = "http://${data.aws_lb.nlb.dns_name}:3000"
  })
  endpoint_api_types        = ["PRIVATE"]
  endpoint_vpc_endpoint_ids = [data.aws_vpc_endpoint.api_gtw.id]
  stage_variables           = local.api_gateway_stage_variables

  tags = merge(
    {
      "deployment_version" = var.api_gateway_deployment_version
    }
  )
}

resource "aws_api_gateway_domain_name" "main" {
  domain_name              = local.zone_name
  regional_certificate_arn = data.aws_acm_certificate.api_custom_domain.arn

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_base_path_mapping" "main" {
  api_id      = module.api_gateway.rest_api_id
  domain_name = aws_api_gateway_domain_name.main.domain_name
  stage_name  = module.api_gateway.rest_api_stage_name
}

resource "aws_api_gateway_rest_api_policy" "main" {
  rest_api_id = module.api_gateway.rest_api_id
  policy      = local.api_gateway_policy
}

resource "aws_api_gateway_vpc_link" "apigw" {
  name        = "ApiGwVPCLink"
  description = "VPC link to the private network load balancer."
  target_arns = [data.aws_lb.nlb.arn]
}

# Api Gateway API Keys for each tenant
resource "aws_api_gateway_api_key" "api_keys" {
  for_each = local.is_primary_api_key_region ? local.api_key_list : {}
  name     = each.value.api_key_name
}

resource "aws_api_gateway_usage_plan" "api_keys" {
  for_each    = local.api_key_list
  name        = each.value.usage_plan_name
  description = "Usage plan for ${each.value.tenant_name}"

  api_stages {
    api_id = module.api_gateway.rest_api_id
    stage  = module.api_gateway.rest_api_stage_name
  }

  throttle_settings {
    burst_limit = each.value.burst_limit
    rate_limit  = each.value.rate_limit
  }
}

resource "aws_api_gateway_usage_plan_key" "api_keys" {
  for_each = local.is_primary_api_key_region ? local.api_key_list : {
    for usage_plan_name, api_key_config in local.api_key_list :
    usage_plan_name => api_key_config
    if local.api_key_ids[usage_plan_name] != null
  }

  key_id        = local.api_key_ids[each.key]
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.api_keys[each.key].id
}
