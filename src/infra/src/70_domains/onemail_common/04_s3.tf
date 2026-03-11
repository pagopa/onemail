module "s3_code_bucket" {
  source = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/s3_bucket?ref=main"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"
  name               = "${local.project_nodomain}-lambda-code-deploy"
  tags               = module.tag_config.tags
}
