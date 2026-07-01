locals {
  project                         = "${var.prefix}-${var.env_short}-${var.location_short}-${var.domain}"
  project_nodomain                = "${var.prefix}-${var.env_short}-${var.location_short}"
  project_nodomain_ses            = "${var.prefix}-${var.env_short}"
  product                         = "${var.prefix}-${var.env_short}"
  ses_authorization_regions       = length(var.ses_regions) > 0 ? var.ses_regions : [var.aws_region]
  ses_multi_region_parameter_name = "/onemail/${local.product}/ses/multi-region-endpoint-id"
  zone_name                       = var.env == "prod" ? var.dns_zone_name : "${var.env}.${var.dns_zone_name}"
  api_key_primary_region          = "eu-south-1"
  api_key_secondary_region        = var.env == "prod" ? "eu-central-1" : null
  is_primary_api_key_region       = var.aws_region == local.api_key_primary_region
  api_key_sync_script             = abspath("${path.module}/../../../scripts/apigateway-api-key-secondary-sync.sh")
  tenants_file_path               = "${path.module}/../../data/tenants/tenants.json"
  raw_tenants                     = jsondecode(file(local.tenants_file_path))
  tenant_domain_prefix            = var.env == "prod" ? "" : "${var.env}."
  tenant_name_prefix              = "${local.project_nodomain_ses}-tenant"
  configuration_set_name_prefix   = "${local.project_nodomain_ses}-configuration-set"
  tenant_domains = {
    for tenant_key, tenant_data in local.raw_tenants : tenant_key => try(
      tenant_data.domain[var.env],
      format("%s%s", local.tenant_domain_prefix, tenant_data.domain),
      null
    )
  }
  tenants = {
    for tenant_key, tenant_data in local.raw_tenants : tenant_key => {
      domain                 = local.tenant_domains[tenant_key]
      admin_email            = format("%s@%s", tenant_data.admin_mailbox, local.tenant_domains[tenant_key])
      tenant_name            = "${local.tenant_name_prefix}-${tenant_key}"
      configuration_set_name = "${local.configuration_set_name_prefix}-${tenant_key}"
      usage_plan_name        = lookup(tenant_data, "usage_plan_name", format("%s-api-plan-%s", local.project, lower(tenant_key)))
    } if try(length(trimspace(local.tenant_domains[tenant_key])) > 0, false)
  }
  api_key_list = {
    for tenant_key, tenant in local.tenants : tenant.usage_plan_name => {
      api_key_name    = "apiKey-${tenant_key}"
      burst_limit     = var.api_gateway_usage_plan_throttle.burst_limit
      rate_limit      = var.api_gateway_usage_plan_throttle.rate_limit
      tenant_key      = tenant_key
      tenant_name     = tenant.tenant_name
      usage_plan_name = tenant.usage_plan_name
    }
  }
  current_region_api_keys = data.aws_api_gateway_api_keys.current_region.items != null ? data.aws_api_gateway_api_keys.current_region.items : []
  current_region_api_key_name_to_id = {
    for item in local.current_region_api_keys :
    item.name => item.id
    if contains([for _, api_key_config in local.api_key_list : api_key_config.api_key_name], item.name)
  }
  missing_current_region_api_key_names = [
    for _, api_key_config in local.api_key_list : api_key_config.api_key_name
    if !local.is_primary_api_key_region
    && local.api_key_secondary_region != null
    && lookup(local.current_region_api_key_name_to_id, api_key_config.api_key_name, null) == null
  ]
  api_key_ids = local.is_primary_api_key_region ? {
    for usage_plan_name, _ in local.api_key_list : usage_plan_name => aws_api_gateway_api_key.api_keys[usage_plan_name].id
    } : {
    for usage_plan_name, api_key_config in local.api_key_list :
    usage_plan_name => lookup(local.current_region_api_key_name_to_id, api_key_config.api_key_name, null)
  }
  api_gateway_stage_variables = {
    for usage_plan_name, api_key_config in local.api_key_list :
    local.api_key_ids[usage_plan_name] => api_key_config.tenant_name
    if local.is_primary_api_key_region || local.api_key_ids[usage_plan_name] != null
  }
  api_gateway_tenant_request_template = file("${path.module}/openapi/tenant-request-mapping.vtl")
  gsis                                = { for g in data.aws_dynamodb_table.EmailStatusHistory.global_secondary_index : g.name => g }
  tenant_config_gsis                  = { for g in data.aws_dynamodb_table.TenantConfig.global_secondary_index : g.name => g }
  dynamodb_kms_key_arn = try(
    one(data.aws_dynamodb_table.EmailStatusHistory.server_side_encryption).kms_key_arn,
    null
  )
  tenant_config_kms_key_arn = try(
    one(data.aws_dynamodb_table.TenantConfig.server_side_encryption).kms_key_arn,
    null
  )
}
