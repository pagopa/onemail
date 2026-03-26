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

resource "aws_sesv2_configuration_set_event_destination" "to_eb" {
  #for_each               = var.tenants
  count                  = var.enable_ses ? 1 : 0
  configuration_set_name = aws_sesv2_configuration_set.config_set[0].configuration_set_name
  event_destination_name = "dest-eb-${local.project_nodomain}"

  event_destination {
    enabled              = true
    matching_event_types = ["SEND", "REJECT", "BOUNCE", "COMPLAINT", "DELIVERY"]
    event_bridge_destination {
      event_bus_arn = "arn:aws:events:${var.aws_region}:${data.aws_caller_identity.current.account_id}:event-bus/default"
    }
  }
}

resource "aws_cloudwatch_event_rule" "ses_rule" {
  count = var.enable_ses ? 1 : 0
  name  = "ses-central-rule"
  event_pattern = jsonencode({
    source      = ["aws.ses"],
    detail-type = ["SES Event"],
    detail      = { "configuration-set-name" = [{ prefix = "${local.project_nodomain}-configuration-set*" }] }
  })
}

resource "aws_cloudwatch_event_target" "sqs_target" {
  count = var.enable_ses ? 1 : 0
  rule  = aws_cloudwatch_event_rule.ses_rule[0].name
  arn   = aws_sqs_queue.sqs_set_processor.arn
}

resource "aws_sqs_queue_policy" "eb_to_sqs" {
  count     = var.enable_ses ? 1 : 0
  queue_url = aws_sqs_queue.sqs_set_processor.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "events.amazonaws.com" },
      Action    = "sqs:SendMessage",
      Resource  = aws_sqs_queue.sqs_set_processor.arn,
      Condition = { ArnEquals = { "aws:SourceArn" = aws_cloudwatch_event_rule.ses_rule[0].arn } }
    }]
  })
}
