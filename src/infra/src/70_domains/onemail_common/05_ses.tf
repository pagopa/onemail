# Tenants
resource "aws_sesv2_tenant" "tenants" {
  for_each    = local.tenants
  tenant_name = each.value.tenant_name
}

# Email identities for each tenant
resource "aws_sesv2_email_identity" "tenant_identities" {
  for_each       = local.tenants
  email_identity = each.value.domain

  configuration_set_name = aws_sesv2_configuration_set.config_set[each.key].configuration_set_name

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

# Custom MAIL FROM domain for SPF and DMARC alignment per tenant
resource "aws_ses_domain_mail_from" "tenant_mail_from" {
  for_each         = local.tenants
  domain           = aws_sesv2_email_identity.tenant_identities[each.key].email_identity
  mail_from_domain = "bounce.${each.value.domain}"
  # In test phase: allow SES fallback if the custom MAIL FROM MX is not ready yet.
  # Production: set this to "RejectMessage" to avoid implicit fallback.
  behavior_on_mx_failure = var.env == "prod" ? "RejectMessage" : "UseDefaultValue"
}

# resource "aws_ses_account_suppression_attributes" "main" {
#   suppressed_reasons = ["BOUNCE", "COMPLAINT"]
# }

resource "aws_sesv2_configuration_set" "config_set" {
  for_each               = local.tenants
  configuration_set_name = each.value.configuration_set_name

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

resource "aws_sesv2_tenant_resource_association" "identity_assoc" {
  for_each     = local.tenants
  tenant_name  = aws_sesv2_tenant.tenants[each.key].tenant_name
  resource_arn = aws_sesv2_email_identity.tenant_identities[each.key].arn
}

resource "aws_sesv2_tenant_resource_association" "config_set_assoc" {
  for_each     = local.tenants
  tenant_name  = aws_sesv2_tenant.tenants[each.key].tenant_name
  resource_arn = aws_sesv2_configuration_set.config_set[each.key].arn
}

resource "aws_sesv2_configuration_set_event_destination" "to_eb" {
  for_each               = local.tenants
  configuration_set_name = aws_sesv2_configuration_set.config_set[each.key].configuration_set_name
  event_destination_name = "dest-eb-${local.project_nodomain}-${each.key}"

  event_destination {
    enabled              = true
    matching_event_types = ["REJECT", "BOUNCE", "COMPLAINT", "DELIVERY"]
    event_bridge_destination {
      event_bus_arn = "arn:aws:events:${var.aws_region}:${data.aws_caller_identity.current.account_id}:event-bus/default"
    }
  }
}

resource "terraform_data" "seed_tenant_config" {
  for_each = local.tenants

  depends_on = [module.dynamodb_table["tenant_config"]]

  input = {
    tenant_name            = aws_sesv2_tenant.tenants[each.key].tenant_name
    configuration_set_name = aws_sesv2_configuration_set.config_set[each.key].configuration_set_name
  }

  provisioner "local-exec" {
    command = "${local.seed_tenant_config_script_path} --env ${var.env} --client-name ${each.key}"

    environment = {
      AWS_REGION = var.aws_region
    }

    interpreter = ["/usr/bin/env", "bash"]
  }
}

resource "aws_cloudwatch_event_rule" "ses_rule" {
  name        = "${local.project_nodomain}-${var.env}-ses-central-rule"
  description = "Central rule to capture SES events for all tenants in ${var.env} environment"
  event_pattern = jsonencode({
    source      = ["aws.ses"],
    detail-type = ["Email Delivered", "Email Complaint Received", "Email Bounced", "Email Rejected", "Email Delivery Delayed"],
    detail = {
      mail = {
        tenant = {
          tenantName = [{ prefix = "${local.tenant_name_prefix}-" }]
        }
      }
    }
  })
}

resource "aws_cloudwatch_event_target" "sqs_target" {
  rule = aws_cloudwatch_event_rule.ses_rule.name
  arn  = aws_sqs_queue.sqs_set_processor.arn
}

resource "aws_sqs_queue_policy" "eb_to_sqs" {
  queue_url = aws_sqs_queue.sqs_set_processor.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "events.amazonaws.com" },
      Action    = "sqs:SendMessage",
      Resource  = aws_sqs_queue.sqs_set_processor.arn,
      Condition = { ArnEquals = { "aws:SourceArn" = aws_cloudwatch_event_rule.ses_rule.arn } }
    }]
  })
}
