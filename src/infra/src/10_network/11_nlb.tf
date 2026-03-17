module "nlb" {
  #source = "./.terraform/modules/aws_modules/IDVH/nlb"
  source = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/nlb?ref=main"

  product_name       = "onemail"
  env                = var.env
  idvh_resource_tier = "standard"
  name               = "${local.project}-elb"
  vpc_id             = module.vpc.vpc_id
  private_subnets    = module.vpc.private_subnets
  vpc_cidr_block     = var.vpc_cidr

  tags = module.tag_config.tags

}
