locals {
  project                       = "${var.prefix}-${var.env_short}-${var.location_short}-${var.domain}"
  project_nodomain              = "${var.prefix}-${var.env_short}-${var.location_short}"
  product                       = "${var.prefix}-${var.env_short}"
  zone_name                     = var.env == "prod" ? var.dns_zone_name : "${var.env}.${var.dns_zone_name}"
  tenants_file_path             = "${path.module}/../../data/tenants/tenants.json"
  raw_tenants                   = var.enable_ses ? jsondecode(file(local.tenants_file_path)) : {}
  tenant_domain_prefix          = var.env == "prod" ? "" : "${var.env}."
  tenant_name_prefix            = "${local.project_nodomain}-tenant"
  configuration_set_name_prefix = "${local.project_nodomain}-configuration-set"
  tenants = {
    for tenant_key, tenant_data in local.raw_tenants : tenant_key => {
      domain                 = "${local.tenant_domain_prefix}${tenant_data.domain}"
      admin_email            = format("%s@%s", tenant_data.admin_mailbox, "${local.tenant_domain_prefix}${tenant_data.domain}")
      tenant_name            = "${local.tenant_name_prefix}-${tenant_key}"
      configuration_set_name = "${local.configuration_set_name_prefix}-${tenant_key}"
      usage_plan_name        = lookup(tenant_data, "usage_plan_name", format("%s-api-plan-%s", local.project, lower(tenant_key)))
    }
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
  api_gateway_stage_variables = {
    for usage_plan_name, api_key_config in local.api_key_list :
    aws_api_gateway_api_key.api_keys[usage_plan_name].id => api_key_config.tenant_name
  }
  api_gateway_tenant_request_template = file("${path.module}/openapi/tenant-request-mapping.vtl")
  gsis                                = { for g in data.aws_dynamodb_table.EmailStatusHistory.global_secondary_index : g.name => g }
  dynamodb_kms_key_arn = try(
    one(data.aws_dynamodb_table.EmailStatusHistory.server_side_encryption).kms_key_arn,
    null
  )

  # Deterministic ARNs for scheduler resources (avoids count errors with lambda_policy_json)
  scheduler_role_name  = "${local.project_nodomain}-scheduler-sqs-role"
  scheduler_group_name = "${local.project_nodomain}-ses-dynamic-retries-group"
  scheduler_role_arn   = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${local.scheduler_role_name}"
  scheduler_group_arn  = "arn:aws:scheduler:${var.aws_region}:${data.aws_caller_identity.current.account_id}:schedule-group/${local.scheduler_group_name}"
  schedule_arn_prefix  = "arn:aws:scheduler:${var.aws_region}:${data.aws_caller_identity.current.account_id}:schedule/${local.scheduler_group_name}"
}
