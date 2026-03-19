# Route53 Hosted Zones Configuration

data "aws_ses_domain_identity" "onemail" {
  count  = var.enable_ses_dns_records ? 1 : 0
  domain = local.zone_name
}

locals {
  # Build zone name based on environment
  zone_name = var.env == "prod" ? var.dns_zone_name : "${var.env}.${var.dns_zone_name}"

  # SES DNS records are enabled only after SES resources are provisioned in onemail_common
  ses_dns_enabled = var.enable_ses_dns_records
}

locals {
  ses_verification_token  = local.ses_dns_enabled ? try(data.aws_ses_domain_identity.onemail[0].verification_token, null) : null
  ses_mail_from_subdomain = local.ses_dns_enabled ? "bounce" : null
  # Test posture: monitor only, with relaxed alignment to reduce false negatives while validating flows.
  # Production target: add reporting (`rua`, optionally `ruf`) and move policy toward `quarantine` or `reject`.
  ses_dmarc_value = local.ses_dns_enabled ? "v=DMARC1; p=none; adkim=r; aspf=r; fo=1; pct=100" : null

  # All possible DNS records with consistent object structure
  dns_records_base = {
    # NS delegation records (PROD only)
    "ns_dev" = {
      display_name = "dev"
      name         = "dev"
      type         = "NS"
      ttl          = 86400
      records      = ["ns-1918.awsdns-47.co.uk.", "ns-1006.awsdns-61.net.", "ns-1124.awsdns-12.org.", "ns-341.awsdns-42.com."]
      is_alias     = false
      alias_config = null
      include      = var.env == "prod"
    }
    "ns_uat" = {
      display_name = "uat"
      name         = "uat"
      type         = "NS"
      ttl          = 86400
      records      = ["ns-1494.awsdns-58.org.", "ns-113.awsdns-14.com.", "ns-938.awsdns-53.net.", "ns-1992.awsdns-57.co.uk."]
      is_alias     = false
      alias_config = null
      include      = var.env == "prod"
    }
    # Global Accelerator alias record (all environments)
    "root_ga_alias" = {
      display_name = "root_ga_alias"
      name         = ""
      type         = "A"
      ttl          = null
      records      = null
      is_alias     = true
      alias_config = {
        name                   = aws_globalaccelerator_accelerator.this.dns_name
        zone_id                = aws_globalaccelerator_accelerator.this.hosted_zone_id
        evaluate_target_health = true
      }
      include = true
    }
    # SES verification TXT record
    "ses_verification" = {
      display_name = "ses_verification"
      name         = "_amazonses"
      type         = "TXT"
      ttl          = 600
      records      = local.ses_verification_token == null ? [] : [local.ses_verification_token]
      is_alias     = false
      alias_config = null
      include      = local.ses_verification_token != null
    }
    # SES custom MAIL FROM MX record
    "ses_mail_from_mx" = {
      display_name = "ses_mail_from_mx"
      name         = local.ses_mail_from_subdomain
      type         = "MX"
      ttl          = 600
      records      = local.ses_mail_from_subdomain == null ? [] : ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
      is_alias     = false
      alias_config = null
      include      = local.ses_mail_from_subdomain != null
    }
    # SES custom MAIL FROM SPF record
    "ses_mail_from_spf" = {
      display_name = "ses_mail_from_spf"
      name         = local.ses_mail_from_subdomain
      type         = "TXT"
      ttl          = 600
      # Test posture: use soft fail until the MAIL FROM path is fully validated in every environment.
      # Production target: change `~all` to `-all` if SES is the only legitimate sender for this subdomain.
      records      = local.ses_mail_from_subdomain == null ? [] : ["v=spf1 include:amazonses.com ~all"]
      is_alias     = false
      alias_config = null
      include      = local.ses_mail_from_subdomain != null
    }
    # SES DMARC TXT record
    "ses_dmarc" = {
      display_name = "ses_dmarc"
      name         = "_dmarc"
      type         = "TXT"
      ttl          = 600
      records      = local.ses_dmarc_value == null ? [] : [local.ses_dmarc_value]
      is_alias     = false
      alias_config = null
      include      = local.ses_dmarc_value != null
    }
  }

  # Filter records based on inclusion flag
  all_dns_records = {
    for k, v in local.dns_records_base : v.display_name => {
      name    = v.name
      type    = v.type
      ttl     = v.ttl
      records = v.records
      alias   = v.alias_config
    } if v.include
  }
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
