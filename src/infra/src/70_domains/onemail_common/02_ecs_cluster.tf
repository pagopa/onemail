module "ecs_cluster" {
  source = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/ecs_cluster?ref=main"
  #source                    = "./.terraform/modules/aws_modules/IDVH/ecs_cluster"
  env                       = var.env
  product_name              = "onemail"
  idvh_resource_tier        = "standard"
  cluster_name              = "${local.project_nodomain}-ecs-cluster"
  enable_container_insights = var.enable_container_insights
  tags                      = module.tag_config.tags
}
