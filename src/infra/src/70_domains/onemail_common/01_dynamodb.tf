module "dynamodb_table" {
  for_each = var.dynamodb_tables
  source   = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/dynamodb?ref=main"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"

  table_config   = each.value
  create_kms_key = each.value.create_kms_key
  kms_alias      = each.value.kms_alias
  tags = merge(
    module.tag_config.tags,
    {
      Name = each.value.table_name
    }
  )
}
