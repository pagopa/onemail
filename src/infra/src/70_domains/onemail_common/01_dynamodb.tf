module "dynamodb_table" {
  for_each = var.dynamodb_tables
  source   = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/dynamodb?ref=b67558d9742f7d1824ab3ed034bc49f8f45e020a"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"

  table_config       = each.value
  create_kms_key     = each.value.create_kms_key
  enable_replication = try(each.value.replication_enabled, false)
  kms_alias          = each.value.kms_alias
  tags = merge(
    module.tag_config.tags,
    {
      Name = each.value.table_name
    }
  )
}
