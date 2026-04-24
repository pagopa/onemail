locals {
  project                       = "${var.prefix}-${var.env_short}-${var.location_short}-${var.domain}"
  project_nodomain              = "${var.prefix}-${var.env_short}-${var.location_short}"
  project_nodomain_ses          = "${var.prefix}-${var.env_short}"
  zone_name                     = var.env == "prod" ? var.dns_zone_name : "${var.env}.${var.dns_zone_name}"
  product                       = "${var.prefix}-${var.env_short}"
  tenants_file_path             = "${path.module}/../../data/tenants/tenants.json"
  raw_tenants                   = jsondecode(file(local.tenants_file_path))
  tenant_domain_prefix          = var.env == "prod" ? "" : "${var.env}."
  tenant_name_prefix            = "${local.project_nodomain_ses}-tenant"
  configuration_set_name_prefix = "${local.project_nodomain_ses}-configuration-set"
  tenants = {
    for tenant_key, tenant_data in local.raw_tenants : tenant_key => {
      domain                 = "${local.tenant_domain_prefix}${tenant_data.domain}"
      admin_email            = format("%s@%s", tenant_data.admin_mailbox, "${local.tenant_domain_prefix}${tenant_data.domain}")
      tenant_name            = "${local.tenant_name_prefix}-${tenant_key}"
      configuration_set_name = "${local.configuration_set_name_prefix}-${tenant_key}"
    }
  }
}
