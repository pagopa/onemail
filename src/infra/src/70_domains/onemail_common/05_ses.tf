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

  dynamic "dkim_signing_attributes" {
    for_each = var.ses_deed_parent_region == null ? [1] : []

    content {
      next_signing_key_length = "RSA_2048_BIT"
    }
  }
}

resource "terraform_data" "tenant_identity_deed" {
  for_each = var.ses_deed_parent_region != null ? local.tenants : {}

  depends_on = [aws_sesv2_email_identity.tenant_identities]

  triggers_replace = [
    each.value.domain,
    var.ses_deed_parent_region,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      set -euo pipefail

      aws sesv2 put-email-identity-dkim-signing-attributes \
        --email-identity "$SES_EMAIL_IDENTITY" \
        --signing-attributes-origin "$SES_PARENT_SIGNING_ORIGIN"
    EOT

    environment = {
      AWS_REGION                = var.aws_region
      SES_EMAIL_IDENTITY        = each.value.domain
      SES_PARENT_SIGNING_ORIGIN = "AWS_SES_${upper(replace(var.ses_deed_parent_region, "-", "_"))}"
    }

    interpreter = ["/usr/bin/env", "bash", "-c"]
  }
}

# Custom MAIL FROM domain for SPF and DMARC alignment per tenant
resource "aws_ses_domain_mail_from" "tenant_mail_from" {
  for_each         = local.tenants
  domain           = aws_sesv2_email_identity.tenant_identities[each.key].email_identity
  mail_from_domain = var.ses_deed_parent_region == null ? "bounce.${each.value.domain}" : "bounce.${var.location_short}.${each.value.domain}"
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
    matching_event_types = ["REJECT", "BOUNCE", "COMPLAINT", "DELIVERY", "RENDERING_FAILURE"]
    event_bridge_destination {
      event_bus_arn = "arn:aws:events:${var.aws_region}:${data.aws_caller_identity.current.account_id}:event-bus/default"
    }
  }
}

resource "terraform_data" "ses_multi_region_endpoint" {
  count = var.create_ses_multi_region_endpoint ? 1 : 0

  input = {
    aws_region    = var.aws_region
    endpoint_name = "${local.project_nodomain_ses}-ses-multi-region-endpoint"
  }

  triggers_replace = [var.secondary_aws_region]

  provisioner "local-exec" {
    command = <<-EOT
      set -euo pipefail

      if aws sesv2 get-multi-region-endpoint --endpoint-name "$SES_ENDPOINT_NAME" >/dev/null 2>&1; then
        echo "SES multi-region endpoint '$SES_ENDPOINT_NAME' already exists."
        exit 0
      fi

      aws sesv2 create-multi-region-endpoint \
        --endpoint-name "$SES_ENDPOINT_NAME" \
        --details "{\"RoutesDetails\":[{\"Region\":\"$SES_SECONDARY_REGION\"}]}"
    EOT

    environment = {
      AWS_REGION           = var.aws_region
      SES_ENDPOINT_NAME    = "${local.project_nodomain_ses}-ses-multi-region-endpoint"
      SES_SECONDARY_REGION = var.secondary_aws_region
    }

    interpreter = ["/usr/bin/env", "bash", "-c"]
  }

  provisioner "local-exec" {
    when = destroy

    command = <<-EOT
      set -euo pipefail

      if ! aws sesv2 get-multi-region-endpoint --endpoint-name "$SES_ENDPOINT_NAME" >/dev/null 2>&1; then
        echo "SES multi-region endpoint '$SES_ENDPOINT_NAME' already absent."
        exit 0
      fi

      aws sesv2 delete-multi-region-endpoint --endpoint-name "$SES_ENDPOINT_NAME"
    EOT

    environment = {
      AWS_REGION        = self.input.aws_region
      SES_ENDPOINT_NAME = self.input.endpoint_name
    }

    interpreter = ["/usr/bin/env", "bash", "-c"]
  }
}

resource "terraform_data" "seed_tenant_config" {
  for_each = contains(keys(var.dynamodb_tables), "tenant_config") ? local.tenants : {}

  depends_on = [module.dynamodb_table]

  input = {
    tenant_name            = aws_sesv2_tenant.tenants[each.key].tenant_name
    configuration_set_name = aws_sesv2_configuration_set.config_set[each.key].configuration_set_name
  }

  provisioner "local-exec" {
    command = "${local.seed_tenant_config_script_path} --env ${var.env} --client-name ${each.key} --table-name ${try(var.dynamodb_tables["tenant_config"].table_name, "TenantConfig")}"

    environment = {
      AWS_REGION = var.aws_region
    }

    interpreter = ["/usr/bin/env", "bash", "-c"]
  }
}

resource "aws_cloudwatch_event_rule" "ses_rule" {
  name        = "${local.project_nodomain}-${var.env}-ses-central-rule"
  description = "Central rule to capture SES events for all tenants in ${var.env} environment"
  event_pattern = jsonencode({
    source      = ["aws.ses"],
    detail-type = ["Email Delivered", "Email Complaint Received", "Email Bounced", "Email Rejected", "Email Delivery Delayed", "Email Rendering Failed"],
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
