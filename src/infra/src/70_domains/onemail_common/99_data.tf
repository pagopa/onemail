data "aws_route53_zone" "onemail" {
  count        = var.enable_ses ? 1 : 0
  name         = local.zone_name
  private_zone = false
}

data "aws_caller_identity" "current" {}
