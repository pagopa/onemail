locals {
  project          = "${var.prefix}-${var.env_short}-${var.location_short}-${var.domain}"
  project_nodomain = "${var.prefix}-${var.env_short}-${var.location_short}"
  product          = "${var.prefix}-${var.env_short}"
  zone_name        = var.env == "prod" ? var.dns_zone_name : "${var.env}.${var.dns_zone_name}"
  gsi_name         = one(data.aws_dynamodb_table.EmailStatusHistory.global_secondary_index).name
}
