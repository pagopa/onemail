data "aws_route53_zone" "onemail" {
  count        = var.enable_ses ? 1 : 0
  name         = local.zone_name
  private_zone = false
}

resource "aws_sesv2_email_identity" "tenant_identities" {
  count          = var.enable_ses ? 1 : 0
  email_identity = local.zone_name

  configuration_set_name = aws_sesv2_configuration_set.config_set[0].configuration_set_name
}

# DKIM configuration
resource "aws_ses_domain_dkim" "onemail_dkim" {
  count  = var.enable_ses ? 1 : 0
  domain = aws_sesv2_email_identity.tenant_identities[0].email_identity
}

resource "aws_route53_record" "ses_dkim_records" {
  count   = var.enable_ses ? 3 : 0
  zone_id = data.aws_route53_zone.onemail[0].zone_id
  name    = "${element(aws_ses_domain_dkim.onemail_dkim[0].dkim_tokens, count.index)}._domainkey.${local.zone_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${element(aws_ses_domain_dkim.onemail_dkim[0].dkim_tokens, count.index)}.dkim.${var.aws_region}.amazonses.com"]
}

# Custom MAIL FROM domain for SPF and DMARC alignment
resource "aws_ses_domain_mail_from" "onemail_mail_from" {
  count            = var.enable_ses ? 1 : 0
  domain           = aws_sesv2_email_identity.tenant_identities[0].email_identity
  mail_from_domain = "bounce.${local.zone_name}"
  # In test phase: allow SES fallback if the custom MAIL FROM MX is not ready yet.
  # Production: set this to "RejectMessage" to avoid implicit fallback.
  behavior_on_mx_failure = var.env == "prod" ? "RejectMessage" : "UseDefaultValue"
}

# resource "aws_ses_account_suppression_attributes" "main" {
#   count = var.enable_ses ? 1 : 0
#   suppressed_reasons = ["BOUNCE", "COMPLAINT"]
# }

resource "aws_sesv2_configuration_set" "config_set" {
  count                  = var.enable_ses ? 1 : 0
  configuration_set_name = "${local.project_nodomain}-${var.env}-configuration-set"

  sending_options {
    sending_enabled = true
  }

  reputation_options {
    reputation_metrics_enabled = true
  }

  delivery_options {
    tls_policy = "REQUIRE"
  }
}
