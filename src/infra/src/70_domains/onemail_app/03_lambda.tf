data "aws_iam_policy_document" "sender_policy" {
  statement {
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes"
    ]
    resources = [
      data.aws_sqs_queue.high_priority.arn,
      data.aws_sqs_queue.low_priority.arn
    ]
  }

  statement {
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail"
    ]
    resources = ["*"]
  }

  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:GetItem"
    ]
    resources = [data.aws_dynamodb_table.EmailStatusHistory.arn]
  }
}

module "security_group_lambda_sender" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "4.17.2"

  name        = "${local.project_nodomain}-sg-lambda-sender"
  description = "Security group for sender lambda"
  vpc_id      = data.aws_vpc.core.id

  egress_cidr_blocks      = []
  egress_ipv6_cidr_blocks = []

  egress_prefix_list_ids = [
    data.aws_vpc_endpoint.dynamodb.prefix_list_id
  ]

  egress_rules = ["https-443-tcp"]
}

module "lambda_sender" {
  source = "./.terraform/modules/aws_modules/IDVH/lambda"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"

  name        = "${local.project_nodomain}-lambda-sender"
  description = "Lambda function responsible for sending emails, triggered by SQS messages from both high and low priority queues."

  package_path       = "${path.module}/${var.lambda_sender.package_path}"
  lambda_policy_json = data.aws_iam_policy_document.sender_policy.json

  memory_size                    = 256
  reserved_concurrent_executions = var.lambda_sender.reserved_concurrent_executions
  environment_variables          = var.lambda_sender.environment_variables
  vpc_subnet_ids                 = data.aws_subnets.private.ids
  vpc_security_group_ids         = [module.security_group_lambda_sender.security_group_id]

  tags = module.tag_config.tags
}

resource "aws_lambda_event_source_mapping" "high_priority_sender" {
  event_source_arn = data.aws_sqs_queue.high_priority.arn
  function_name    = module.lambda_sender.lambda_function_arn
  scaling_config { maximum_concurrency = 8 } # To adjust based on expected load for high priority tasks
}

resource "aws_lambda_event_source_mapping" "low_priority_sender" {
  event_source_arn = data.aws_sqs_queue.low_priority.arn
  function_name    = module.lambda_sender.lambda_function_arn
  scaling_config { maximum_concurrency = 2 } # To adjust based on expected load for low priority tasks
}
