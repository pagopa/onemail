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
    resources = var.enable_ses ? [data.aws_ses_domain_identity.onemail[0].arn, data.aws_sesv2_configuration_set.oml_config_set[0].arn] : ["*"]

    dynamic "condition" {
      for_each = var.enable_ses ? [1] : []

      content {
        test     = "StringLike"
        variable = "ses:FromAddress"
        values   = [local.ses_allowed_sender_pattern]
      }
    }
  }

  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:BatchWriteItem",
      "dynamodb:BatchGetItem"
    ]
    resources = [
      data.aws_dynamodb_table.EmailStatusHistory.arn,
      "${data.aws_dynamodb_table.EmailStatusHistory.arn}/index/${local.gsi_name}"
    ]
  }

  dynamic "statement" {
    for_each = local.dynamodb_kms_key_arn != null ? [local.dynamodb_kms_key_arn] : []

    content {
      sid = "KMSAccess"

      actions = [
        "kms:Decrypt",
        "kms:Encrypt"
      ]

      resources = [statement.value]
    }
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

  #egress_rules = ["https-443-tcp"]
}

resource "aws_vpc_security_group_egress_rule" "sender_https_rule" {
  security_group_id = module.security_group_lambda_sender.security_group_id
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
  cidr_ipv4         = data.aws_vpc.core.cidr_block
}

module "lambda_sender" {
  source = "./.terraform/modules/aws_modules/IDVH/lambda"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"

  name        = "${local.project_nodomain}-lambda-sender"
  description = "Lambda function responsible for sending emails, triggered by SQS messages from both high and low priority queues"

  package_path       = "${path.module}/${var.lambda_sender.package_path}"
  lambda_policy_json = data.aws_iam_policy_document.sender_policy.json

  memory_size                    = 256
  reserved_concurrent_executions = var.lambda_sender.reserved_concurrent_executions
  environment_variables = {
    AWS_EMAIL_DB_TABLE          = data.aws_dynamodb_table.EmailStatusHistory.name
    AWS_EMAIL_DB_REQUEST_ID_GSI = one(data.aws_dynamodb_table.EmailStatusHistory.global_secondary_index).name
    HIGH_PRIORITY_QUEUE_ARN     = data.aws_sqs_queue.high_priority.arn
    LOW_PRIORITY_QUEUE_ARN      = data.aws_sqs_queue.low_priority.arn
    NODE_ENV                    = "production"
  }
  vpc_subnet_ids         = data.aws_subnets.private.ids
  vpc_security_group_ids = [module.security_group_lambda_sender.security_group_id]

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
