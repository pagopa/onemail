module "dynamodb_table" {
  count   = var.dynamodb_table_config != null ? 1 : 0
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.0.1"

  name = var.dynamodb_table_config.table_name

  hash_key  = var.dynamodb_table_config.hash_key
  range_key = var.dynamodb_table_config.range_key

  attributes = var.dynamodb_table_config.attributes

  billing_mode = var.dynamodb_table_config.billing_mode

  point_in_time_recovery_enabled = var.dynamodb_table_config.point_in_time_recovery_enabled
  stream_enabled                 = var.dynamodb_table_config.stream_enabled
  stream_view_type               = var.dynamodb_table_config.stream_view_type
  ttl_attribute_name             = var.dynamodb_table_config.ttl_attribute_name
  deletion_protection_enabled    = var.dynamodb_table_config.deletion_protection_enabled
  replica_regions                = var.dynamodb_table_config.replica_regions

  tags = merge(
    module.tag_config.tags,
    {
      Name = var.dynamodb_table_config.table_name
    }
  )
}
