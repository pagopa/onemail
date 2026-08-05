data "aws_route53_zone" "onemail" {
  name         = local.zone_name
  private_zone = false
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}
