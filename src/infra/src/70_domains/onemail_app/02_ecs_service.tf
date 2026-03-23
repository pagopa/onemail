data "aws_iam_policy_document" "ecs_task_policy" {
  statement {
    sid = "SqsWriteAccess"

    actions = [
      "sqs:SendMessage",
      "sqs:SendMessageBatch",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl"
    ]

    resources = [
      data.aws_sqs_queue.high_priority.arn,
      data.aws_sqs_queue.low_priority.arn
    ]
  }

  statement {
    sid = "DynamoDBAccess"

    actions = [
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:GetItem",
      "dynamodb:DescribeTable",
      "dynamodb:Query"
    ]

    resources = [
      data.aws_dynamodb_table.EmailStatusHistory.arn,
      "${data.aws_dynamodb_table.EmailStatusHistory.arn}/index/${one(data.aws_dynamodb_table.EmailStatusHistory.global_secondary_index).name}"
    ]
  }
}

module "ecs_service" {
  source = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/ecs_service?ref=main"

  env                           = var.env
  product_name                  = "onemail"
  idvh_resource_tier            = "standard"
  service_name                  = "${local.project_nodomain}-ecs-service"
  cluster_arn                   = data.aws_ecs_cluster.core.arn
  image                         = "${data.aws_ecr_repository.ecs_service.repository_url}:${var.ecs_service_image_version}"
  container_name                = "${local.project_nodomain}-ecs-container"
  private_subnets               = data.aws_subnets.private.ids
  target_group_arn              = data.aws_lb_listener.ecs_core.default_action[0].target_group_arn
  nlb_security_group_id         = element(tolist(data.aws_lb.nlb.security_groups), 0)
  task_policy_json              = data.aws_iam_policy_document.ecs_task_policy.json
  create_deploy_role            = true
  deploy_role_github_repository = var.deploy_role_github_repository
  environment_variables = [
    {
      name  = "PORT"
      value = "3000"
    },
    {
      name  = "HOST"
      value = "https://${trimsuffix(data.aws_route53_zone.onemail.name, ".")}"
    },
    {
      name  = "APP_ENV"
      value = var.env
    },
    {
      name  = "AWS_REGION"
      value = var.aws_region
    },
    {
      name  = "AWS_EMAIL_DB_TABLE"
      value = data.aws_dynamodb_table.EmailStatusHistory.name
    },
    {
      name  = "AWS_EMAIL_DB_REQUEST_ID_GSI"
      value = one(data.aws_dynamodb_table.EmailStatusHistory.global_secondary_index).name
    },
    {
      name  = "SQS_HIGH_PRIORITY_QUEUE_URL"
      value = data.aws_sqs_queue.high_priority.url
    },
    {
      name  = "SQS_LOW_PRIORITY_QUEUE_URL"
      value = data.aws_sqs_queue.low_priority.url
    }
  ]

}
