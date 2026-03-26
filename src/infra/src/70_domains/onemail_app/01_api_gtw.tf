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
  #source = "./.terraform/modules/aws_modules/IDVH/api_gateway"
  source             = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/api_gateway?ref=main"
  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"
  name               = "${local.project_nodomain}-api-gateway"
  body = templatefile("${path.module}/${var.openapi_template_file}", {
    connection_id = aws_api_gateway_vpc_link.apigw.id
    uri           = "http://${data.aws_lb.nlb.dns_name}:3000"
    server_url    = local.zone_name
  })
  endpoint_api_types        = ["PRIVATE"]
  endpoint_vpc_endpoint_ids = [data.aws_vpc_endpoint.api_gtw.id]

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
