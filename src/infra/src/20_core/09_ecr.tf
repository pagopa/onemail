module "ecr" {
  source                 = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/ecr?ref=main"
  env                    = var.env
  product_name           = "onemail"
  idvh_resource_tier     = "standard"
  repository_name_prefix = "${local.project_nodomain}-ecr"

}
