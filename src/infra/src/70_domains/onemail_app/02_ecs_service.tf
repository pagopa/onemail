data "aws_ecs_cluster" "core" {
  cluster_name = "${local.project_nodomain}-ecs-cluster"
}

data "aws_vpc" "core" {
  filter {
    name   = "tag:Name"
    values = ["${local.project_nodomain}-vpc"]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.core.id]
  }

  filter {
    name   = "tag:Name"
    values = ["${local.project_nodomain}-vpc-private-*"]
  }
}

data "aws_ecr_repository" "ecs_service" {
  name = "${local.project_nodomain}-ecr-${var.ecs_service_image_name}"
}


data "aws_lb_listener" "ecs_core" {
  load_balancer_arn = data.aws_lb.nlb.arn
  port              = 8080
}


# data "aws_lb_target_group" "ecs" {
#   load_balancer_arn = data.aws_lb.nlb.arn
# }

module "ecs_service" {
  source = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/ecs_service?ref=main"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"

  service_name          = "${local.project_nodomain}-ecs-service"
  cluster_arn           = data.aws_ecs_cluster.core.arn
  image                 = var.use_placeholder_image ? "nginx:latest" : "${data.aws_ecr_repository.ecs_service.repository_url}:${var.ecs_service_image_version}"
  container_name        = "${local.project_nodomain}-ecs-container"
  private_subnets       = data.aws_subnets.private.ids
  target_group_arn      = data.aws_lb_listener.ecs_core.default_action[0].target_group_arn
  nlb_security_group_id = element(tolist(data.aws_lb.nlb.security_groups), 0)
}
