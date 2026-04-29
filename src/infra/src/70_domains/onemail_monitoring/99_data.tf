data "aws_lb" "nlb" {
  name = "${local.project_nodomain}-elb"
}

data "aws_lb_listener" "nlb" {
  load_balancer_arn = data.aws_lb.nlb.arn
  port              = 3000
}

data "aws_lb_target_group" "ecs_core" {
  arn = data.aws_lb_listener.nlb.default_action[0].target_group_arn
}

data "aws_dynamodb_table" "EmailStatusHistory" {
  name = "EmailStatusHistory"
}

data "aws_dynamodb_table" "TenantConfig" {
  name = "TenantConfig"
}

data "aws_ecs_cluster" "core" {
  cluster_name = "${local.project_nodomain}-ecs-cluster"
}

data "aws_ecs_service" "core" {
  cluster_arn  = data.aws_ecs_cluster.core.arn
  service_name = "${local.project_nodomain}-ecs-service"
}

data "aws_sqs_queue" "high_priority" {
  name = "${local.project_nodomain}-sqs-high-priority"
}

data "aws_sqs_queue" "low_priority" {
  name = "${local.project_nodomain}-sqs-low-priority"
}


data "aws_caller_identity" "current" {}
