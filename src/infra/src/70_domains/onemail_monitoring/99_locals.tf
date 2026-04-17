locals {
  project                       = "${var.prefix}-${var.env_short}-${var.location_short}-${var.domain}"
  project_nodomain              = "${var.prefix}-${var.env_short}-${var.location_short}"
  product                       = "${var.prefix}-${var.env_short}"
  emails                        = var.alarm_subscribers != "" ? split(",", data.aws_ssm_parameter.alarm_subscribers[0].value) : []
  tenants_file_path             = "${path.module}/../../data/tenants/tenants.json"
  raw_tenants                   = var.enable_ses ? jsondecode(file(local.tenants_file_path)) : {}
  tenant_domain_prefix          = var.env == "prod" ? "" : "${var.env}."
  tenant_name_prefix            = "${local.project_nodomain}-tenant"
  configuration_set_name_prefix = "${local.project_nodomain}-configuration-set"
  tenants = {
    for tenant_key, tenant_data in local.raw_tenants : tenant_key => {
      tenant_name            = "${local.tenant_name_prefix}-${tenant_key}"
      configuration_set_name = "${local.configuration_set_name_prefix}-${tenant_key}"
    }
  }
}
