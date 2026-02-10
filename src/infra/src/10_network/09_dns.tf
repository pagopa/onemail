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
    # NS Delegation Records
    # Uncomment and populate after creating dev and uat zones
    # "dev" = {
    #   name    = "dev"
    #   type    = "NS"
    #   ttl     = 86400
    #   records = ["ns-xxx.awsdns-xx.com.", "ns-yyy.awsdns-yy.com.", "ns-zzz.awsdns-zz.com.", "ns-aaa.awsdns-aa.com."]
    # }
    # "uat" = {
    #   name    = "uat"
    #   type    = "NS"
    #   ttl     = 86400
    #   records = ["ns-bbb.awsdns-bb.com.", "ns-ccc.awsdns-cc.com.", "ns-ddd.awsdns-dd.com.", "ns-eee.awsdns-ee.com."]
    # }

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
