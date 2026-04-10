locals {
  project                     = "${var.prefix}-${var.env_short}-${var.location_short}"
  project_nodomain            = "${var.prefix}-${var.env_short}-${var.location_short}"
  product                     = "${var.prefix}-${var.env_short}"
  tenants_file_path           = "${path.module}/../data/tenants/tenants.json"
  raw_tenants                 = jsondecode(file(local.tenants_file_path))
  tenant_domain_prefix        = var.env == "prod" ? "" : "${var.env}."
  ses_dns_managed_tenant_keys = toset(["onemail"])
  tenants_with_managed_ses_dns_records = {
    for tenant_key, tenant_data in local.raw_tenants : tenant_key => {
      domain      = "${local.tenant_domain_prefix}${tenant_data.domain}"
      admin_email = format("%s@%s", tenant_data.admin_mailbox, "${local.tenant_domain_prefix}${tenant_data.domain}")
    } if contains(local.ses_dns_managed_tenant_keys, tenant_key)
  }

  web_acl_rules = [
    {
      name                    = "IpReputationList"
      priority                = 1
      managed_rule_group_name = "AWSManagedRulesAmazonIpReputationList"
      vendor_name             = "AWS"
      metric_name             = "IpReputationList"
    },
    {
      name                    = "CommonRuleSet"
      priority                = 2
      managed_rule_group_name = "AWSManagedRulesCommonRuleSet"
      vendor_name             = "AWS"
      metric_name             = "CommonRuleSet"
    },
    {
      name                    = "KnownBadInputsRuleSet"
      priority                = 3
      managed_rule_group_name = "AWSManagedRulesKnownBadInputsRuleSet"
      vendor_name             = "AWS"
      metric_name             = "KnownBadInputsRuleSet"
    },
    {
      name                    = "SQLiRuleSet"
      priority                = 4
      managed_rule_group_name = "AWSManagedRulesSQLiRuleSet"
      vendor_name             = "AWS"
      metric_name             = "SQLiRuleSet"
    }
  ]
}
