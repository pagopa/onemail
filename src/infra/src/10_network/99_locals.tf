locals {
  project          = "${var.prefix}-${var.env_short}-${var.location_short}"
  project_nodomain = "${var.prefix}-${var.env_short}-${var.location_short}"
  product          = "${var.prefix}-${var.env_short}"

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
