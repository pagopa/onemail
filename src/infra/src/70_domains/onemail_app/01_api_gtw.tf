data "aws_vpc_endpoint" "api_gtw" {
  service_name = "com.amazonaws.eu-south-1.execute-api"
}

locals {
  api_gateway_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = "*",
        Action    = "execute-api:Invoke",
        Resource  = "execute-api:/*"
      },
      {
        Effect    = "Deny",
        Principal = "*",
        Action    = "execute-api:Invoke",
        Resource  = "execute-api:/*",
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
  source                    = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/api_gateway?ref=main"
  env                       = var.env
  product_name              = "onemail"
  idvh_resource_tier        = "standard"
  name                      = "${local.project}-api-gateway"
  body                      = templatefile("${path.module}/${var.openapi_template_file}", {})
  endpoint_api_types        = ["PRIVATE"]
  endpoint_vpc_endpoint_ids = [data.aws_vpc_endpoint.api_gtw.id]

  policy = local.api_gateway_policy
}
