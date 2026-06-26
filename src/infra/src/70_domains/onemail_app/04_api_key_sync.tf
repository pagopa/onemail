data "aws_api_gateway_api_keys" "current_region" {
  include_values = false
}

check "secondary_api_keys_available" {
  assert {
    condition     = local.is_primary_api_key_region || local.api_key_secondary_region == null || length(local.missing_current_region_api_key_names) == 0
    error_message = "Missing synchronized API keys in region ${var.aws_region}: ${join(", ", local.missing_current_region_api_key_names)}"
  }
}

resource "terraform_data" "ensure_secondary_api_keys" {
  for_each = local.is_primary_api_key_region && local.api_key_secondary_region != null ? local.api_key_list : {}

  depends_on = [
    aws_api_gateway_api_key.api_keys,
  ]

  triggers_replace = [
    aws_api_gateway_api_key.api_keys[each.key].id,
    each.value.api_key_name,
    local.api_key_secondary_region,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      bash "${local.api_key_sync_script}" \
        -i "$API_KEY_ID" \
        -k "$API_KEY_NAME" \
        -p "$PRIMARY_REGION" \
        -s "$SECONDARY_REGION"
    EOT

    environment = {
      API_KEY_ID       = aws_api_gateway_api_key.api_keys[each.key].id
      API_KEY_NAME     = each.value.api_key_name
      PRIMARY_REGION   = local.api_key_primary_region
      SECONDARY_REGION = local.api_key_secondary_region
    }

    interpreter = ["/usr/bin/env", "bash", "-c"]
  }
}
