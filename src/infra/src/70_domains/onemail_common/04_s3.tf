module "s3_code_bucket" {
  source = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/s3_bucket?ref=b67558d9742f7d1824ab3ed034bc49f8f45e020a"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"
  name               = "${local.project_nodomain}-lambda-code-deploy"
  tags               = module.tag_config.tags
}

module "s3_email_attachments_bucket" {
  source = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/s3_bucket?ref=b67558d9742f7d1824ab3ed034bc49f8f45e020a"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"
  name               = "${local.project_nodomain}-email-attachments"
  tags               = module.tag_config.tags
}
