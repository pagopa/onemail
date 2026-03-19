data "aws_route53_zone" "onemail" {
  count        = var.enable_ses ? 1 : 0
  name         = local.zone_name
  private_zone = false
}

# SES domain identity
resource "aws_ses_domain_identity" "onemail" {
  count  = var.enable_ses ? 1 : 0
  domain = local.zone_name
}

# DKIM configuration
resource "aws_ses_domain_dkim" "onemail_dkim" {
  count  = var.enable_ses ? 1 : 0
  domain = aws_ses_domain_identity.onemail[0].domain
}

resource "aws_route53_record" "ses_dkim_records" {
  count   = var.enable_ses ? 3 : 0
  zone_id = data.aws_route53_zone.onemail[0].zone_id
  name    = "${element(aws_ses_domain_dkim.onemail_dkim[0].dkim_tokens, count.index)}._domainkey.${local.zone_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${element(aws_ses_domain_dkim.onemail_dkim[0].dkim_tokens, count.index)}.dkim.amazonses.com"]
}

# Custom MAIL FROM domain for SPF and DMARC alignment
resource "aws_ses_domain_mail_from" "onemail_mail_from" {
  count            = var.enable_ses ? 1 : 0
  domain           = aws_ses_domain_identity.onemail[0].domain
  mail_from_domain = "bounce.${local.zone_name}"
  # In test phase: allow SES fallback if the custom MAIL FROM MX is not ready yet.
  # Production: set this to "RejectMessage" to avoid implicit fallback.
  behavior_on_mx_failure = "UseDefaultValue"
}

# Configuration set and account-level safety settings
resource "aws_ses_configuration_set" "main" {
  count = var.enable_ses ? 1 : 0
  name  = "onemail-configuration-set"

  reputation_metrics_enabled = true
  sending_enabled            = true

  delivery_options {
    tls_policy = "Require" # Enforce encrypted delivery
  }
}

# resource "aws_ses_account_suppression_attributes" "main" {
#   count = var.enable_ses ? 1 : 0
#   suppressed_reasons = ["BOUNCE", "COMPLAINT"]
# }
