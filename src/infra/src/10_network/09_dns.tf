# Route53 Hosted Zones Configuration

data "aws_ses_domain_identity" "tenant" {
  for_each = var.create_primary_region_public_entrypoint && var.enable_ses_dns_records ? local.tenants_with_managed_ses_dns_records : {}
  domain   = each.value.domain
}

data "aws_sesv2_email_identity" "tenant" {
  for_each       = var.create_primary_region_public_entrypoint && var.enable_ses_dns_records ? local.tenants_with_managed_ses_dns_records : {}
  email_identity = each.value.domain
}

locals {
  # Build zone name based on environment
  zone_name = var.env == "prod" ? var.dns_zone_name : "${var.env}.${var.dns_zone_name}"

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
      include      = var.create_primary_region_public_entrypoint && var.env == "prod"
    }
    "ns_uat" = {
      display_name = "uat"
      name         = "uat"
      type         = "NS"
      ttl          = 86400
      records      = ["ns-1494.awsdns-58.org.", "ns-113.awsdns-14.com.", "ns-938.awsdns-53.net.", "ns-1992.awsdns-57.co.uk."]
      is_alias     = false
      alias_config = null
      include      = var.create_primary_region_public_entrypoint && var.env == "prod"
    }
  }

  ga_dns_records = var.create_primary_region_public_entrypoint ? {
    # Global Accelerator alias record (all environments in the primary region)
    "root_ga_alias" = {
      display_name = "root_ga_alias"
      name         = ""
      type         = "A"
      ttl          = null
      records      = null
      is_alias     = true
      alias_config = {
        name                   = aws_globalaccelerator_accelerator.this[0].dns_name
        zone_id                = aws_globalaccelerator_accelerator.this[0].hosted_zone_id
        evaluate_target_health = true
      }
      include = true
    }
  } : {}

  tenant_dns_records = var.create_primary_region_public_entrypoint && var.enable_ses_dns_records && length(local.tenants_with_managed_ses_dns_records) > 0 ? {
    for record in concat(
      [
        for tenant_key, tenant_data in local.tenants_with_managed_ses_dns_records : {
          id            = "${tenant_key}-ses-verification"
          name          = "_amazonses.${tenant_data.domain}"
          type          = "TXT"
          ttl           = 600
          records       = [data.aws_ses_domain_identity.tenant[tenant_key].verification_token]
          alias         = null
          absolute_name = true
        }
      ],
      flatten([
        for tenant_key, tenant_data in local.tenants_with_managed_ses_dns_records : [
          for token in try(data.aws_sesv2_email_identity.tenant[tenant_key].dkim_signing_attributes[0].tokens, []) : {
            id            = "${tenant_key}-dkim-${token}"
            name          = "${token}._domainkey.${tenant_data.domain}"
            type          = "CNAME"
            ttl           = 600
            records       = ["${token}.dkim.${var.aws_region}.amazonses.com"]
            alias         = null
            absolute_name = true
          }
        ]
      ]),
      [
        for tenant_key, tenant_data in local.tenants_with_managed_ses_dns_records : {
          id            = "${tenant_key}-mail-from-mx"
          name          = "bounce.${tenant_data.domain}"
          type          = "MX"
          ttl           = 600
          records       = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
          alias         = null
          absolute_name = true
        }
      ],
      [
        for tenant_key, tenant_data in local.tenants_with_managed_ses_dns_records : {
          id            = "${tenant_key}-mail-from-spf"
          name          = "bounce.${tenant_data.domain}"
          type          = "TXT"
          ttl           = 600
          records       = ["v=spf1 include:amazonses.com ~all"]
          alias         = null
          absolute_name = true
        }
      ],
      [
        for tenant_key, tenant_data in local.tenants_with_managed_ses_dns_records : {
          id            = "${tenant_key}-dmarc"
          name          = "_dmarc.${tenant_data.domain}"
          type          = "TXT"
          ttl           = 600
          records       = ["v=DMARC1; p=none; adkim=r; aspf=r; fo=1; rua=mailto:${tenant_data.admin_email}"]
          alias         = null
          absolute_name = true
        }
      ]
      ) : record.id => {
      name          = record.name
      type          = record.type
      ttl           = record.ttl
      records       = record.records
      alias         = record.alias
      absolute_name = record.absolute_name
    }
  } : {}

  standard_dns_records = merge({
    for k, v in local.dns_records_base : v.display_name => {
      name          = v.name
      type          = v.type
      ttl           = v.ttl
      records       = v.records
      absolute_name = try(v.absolute_name, false)
    } if v.include && !v.is_alias
  }, local.tenant_dns_records)

  alias_dns_records = {
    for k, v in local.ga_dns_records : v.display_name => {
      name          = v.name
      type          = v.type
      alias         = v.alias_config
      absolute_name = try(v.absolute_name, false)
    } if v.include
  }
}

module "zone" {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-route53.git//modules/zones?ref=385af6e72673f90aa8c835f820067553f905bd17" # v2.11.1

  zones = var.create_primary_region_public_entrypoint ? {
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
  } : {}
}

# DNS Records
resource "aws_route53_record" "dns_records" {
  for_each = local.standard_dns_records

  zone_id = module.zone.route53_zone_zone_id[local.zone_name]
  name    = each.value.absolute_name ? each.value.name : (each.value.name == "" ? local.zone_name : "${each.value.name}.${local.zone_name}")
  type    = each.value.type

  # For standard records (A, CNAME, NS, etc.)
  ttl     = each.value.ttl
  records = each.value.records
}

resource "aws_route53_record" "dns_alias_records" {
  for_each = local.alias_dns_records

  zone_id = module.zone.route53_zone_zone_id[local.zone_name]
  name    = each.value.absolute_name ? each.value.name : (each.value.name == "" ? local.zone_name : "${each.value.name}.${local.zone_name}")
  type    = each.value.type

  # For Alias records (ALB, CloudFront, API Gateway custom domain)
  dynamic "alias" {
    for_each = [each.value.alias]
    content {
      name                   = alias.value.name
      zone_id                = alias.value.zone_id
      evaluate_target_health = try(alias.value.evaluate_target_health, false)
    }
  }
}
