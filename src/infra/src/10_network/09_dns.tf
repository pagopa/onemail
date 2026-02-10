# Route53 Hosted Zones Configuration

locals {
  # Build zone name based on environment
  zone_name = var.env == "prod" ? var.dns_zone_name : "${var.env}.${var.dns_zone_name}"

  # DEV records
  dev_records = var.env == "dev" ? {
    # Dynamic record examples (with resource references)
    # "api" = {
    #   name    = "api"
    #   type    = "CNAME"
    #   ttl     = 300
    #   records = [aws_apigatewayv2_api.main.api_endpoint]
    # }
  } : {}

  # UAT records
  uat_records = var.env == "uat" ? {
    # Add UAT records here
  } : {}

  # PROD records (including NS delegation for dev and uat)
  prod_records = var.env == "prod" ? {
    #NS Delegation Records
    "dev" = {
      name    = "dev"
      type    = "NS"
      ttl     = 86400
      records = ["ns-1918.awsdns-47.co.uk.", "ns-1006.awsdns-61.net.", "ns-1124.awsdns-12.org.", "ns-341.awsdns-42.com."]
    },
    "uat" = {
      name    = "uat"
      type    = "NS"
      ttl     = 86400
      records = ["ns-1494.awsdns-58.org.", "ns-113.awsdns-14.com.", "ns-938.awsdns-53.net.", "ns-1992.awsdns-57.co.uk."]
    }

    # Other PROD records here
  } : {}

  # Merge all records
  all_dns_records = merge(
    local.dev_records,
    local.uat_records,
    local.prod_records
  )
}

module "zone" {
  source  = "terraform-aws-modules/route53/aws//modules/zones"
  version = "~> 2.0"

  zones = {
    "${local.zone_name}" = {
      comment = var.env == "prod" ? "Parent hosted zone for onemail" : "Delegated zone for ${var.env} environment"

      tags = merge(
        module.tag_config.tags,
        {
          Name        = local.zone_name
          Environment = var.env
        }
      )
    }
  }
}

# DNS Records
resource "aws_route53_record" "dns_records" {
  for_each = local.all_dns_records

  zone_id = module.zone.route53_zone_zone_id[local.zone_name]
  name    = each.value.name == "" ? local.zone_name : "${each.value.name}.${local.zone_name}"
  type    = each.value.type

  # For standard records (A, CNAME, NS, etc.)
  ttl     = try(each.value.ttl, null)
  records = try(each.value.records, null)

  # For Alias records (ALB, CloudFront, API Gateway custom domain)
  dynamic "alias" {
    for_each = try(each.value.alias, null) != null ? [each.value.alias] : []
    content {
      name                   = alias.value.name
      zone_id                = alias.value.zone_id
      evaluate_target_health = try(alias.value.evaluate_target_health, false)
    }
  }
}
