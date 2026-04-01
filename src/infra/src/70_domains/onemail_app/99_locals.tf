locals {
  project              = "${var.prefix}-${var.env_short}-${var.location_short}-${var.domain}"
  project_nodomain     = "${var.prefix}-${var.env_short}-${var.location_short}"
  product              = "${var.prefix}-${var.env_short}"
  zone_name            = var.env == "prod" ? var.dns_zone_name : "${var.env}.${var.dns_zone_name}"
  tenants_file_path    = "${path.module}/../../data/tenants/tenants.json"
  raw_tenants          = can(file(local.tenants_file_path)) ? jsondecode(file(local.tenants_file_path)) : {}
  tenant_domain_prefix = var.env == "prod" ? "" : "${var.env}."
  tenants = {
    for tenant_key, tenant_data in local.raw_tenants : tenant_key => {
      domain      = "${local.tenant_domain_prefix}${tenant_data.domain}"
      admin_email = format("%s@%s", tenant_data.admin_mailbox, "${local.tenant_domain_prefix}${tenant_data.domain}")
    }
  }
  gsis = { for g in data.aws_dynamodb_table.EmailStatusHistory.global_secondary_index : g.name => g }
  dynamodb_kms_key_arn = try(
    one(data.aws_dynamodb_table.EmailStatusHistory.server_side_encryption).kms_key_arn,
    null
  )
}
