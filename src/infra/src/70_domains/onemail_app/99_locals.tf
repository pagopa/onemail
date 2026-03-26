locals {
  project          = "${var.prefix}-${var.env_short}-${var.location_short}-${var.domain}"
  project_nodomain = "${var.prefix}-${var.env_short}-${var.location_short}"
  product          = "${var.prefix}-${var.env_short}"
  zone_name        = var.env == "prod" ? var.dns_zone_name : "${var.env}.${var.dns_zone_name}"
  gsis             = { for g in data.aws_dynamodb_table.main.global_secondary_index : g.name => g }
  dynamodb_kms_key_arn = try(
    one(data.aws_dynamodb_table.EmailStatusHistory.server_side_encryption).kms_key_arn,
    null
  )
  # In Test phase: allow any sender in the verified domain while the application sender is still evolving.
  # Production: replace with an explicit mailbox such as "noreply@${local.zone_name}".
  ses_allowed_sender_pattern = "*@${local.zone_name}"
}
