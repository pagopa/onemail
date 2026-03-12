module "dynamodb_table" {
  count  = var.dynamodb_table_config != null ? 1 : 0
  source = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/dynamodb?ref=main"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"

  table_config   = var.dynamodb_table_config # pass-through diretto
  create_kms_key = var.dynamodb_table_config.create_kms_key
  kms_alias      = var.dynamodb_table_config.kms_alias
  tags = merge(
    module.tag_config.tags,
    {
      Name = var.dynamodb_table_config.table_name
    }
  )
}
