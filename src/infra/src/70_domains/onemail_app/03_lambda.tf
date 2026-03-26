# Lambda Sender
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
      "ses:SendRawEmail",
      "ses:SendTemplatedEmail",
      "ses:SendBulkEmail",
      "ses:SendBulkTemplatedEmail"
    ]
    resources = var.enable_ses && var.env != "dev" ? [data.aws_ses_domain_identity.onemail[0].arn, data.aws_sesv2_configuration_set.oml_config_set[0].arn, "arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:template/*"] : ["*"]

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
      local.gsis["gsi_request_id_idx"].name
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

  egress_with_cidr_blocks = [
    {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      description = "HTTPS to VPC"
      cidr_blocks = data.aws_vpc.core.cidr_block
    }
  ]
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
    AWS_EMAIL_DB_REQUEST_ID_GSI = local.gsis["gsi_request_id_idx"].name
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

# Lambda Config Set Processor
data "aws_iam_policy_document" "set_processor_policy" {
  statement {
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes"
    ]
    resources = [data.aws_sqs_queue.sqs_set_processor.arn] # Broad permissions for SQS queues, to be refined with specific ARNs when queue is created
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
      local.gsis["gsi_ses_message_id_idx"].name
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


module "security_group_lambda_set_processor" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "4.17.2"

  name        = "${local.project_nodomain}-sg-lambda-config-set-processor"
  description = "Security group for config set processor lambda"
  vpc_id      = data.aws_vpc.core.id

  egress_cidr_blocks      = []
  egress_ipv6_cidr_blocks = []

  egress_prefix_list_ids = [
    data.aws_vpc_endpoint.dynamodb.prefix_list_id
  ]

  egress_with_cidr_blocks = [
    {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      description = "HTTPS to VPC"
      cidr_blocks = data.aws_vpc.core.cidr_block
    }
  ]
}

module "lambda_set_processor" {
  source = "./.terraform/modules/aws_modules/IDVH/lambda"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"

  name        = "${local.project_nodomain}-lambda-config-set-processor"
  description = "Lambda function responsible for processing config sets, triggered by SQS messages from both high and low priority queues"

  package_path       = "${path.module}/${var.lambda_set_processor.package_path}"
  lambda_policy_json = data.aws_iam_policy_document.set_processor_policy.json

  memory_size                    = 256
  reserved_concurrent_executions = var.lambda_set_processor.reserved_concurrent_executions
  environment_variables = {
    AWS_EMAIL_DB_TABLE               = data.aws_dynamodb_table.EmailStatusHistory.name
    AWS_EMAIL_DB_MESSAGE_ID_GSI      = local.gsis["gsi_ses_message_id_idx"].name
    AWS_CLOUDWATCH_METRICS_NAMESPACE = "AWS/SES"
  }
  vpc_subnet_ids         = data.aws_subnets.private.ids
  vpc_security_group_ids = [module.security_group_lambda_set_processor.security_group_id]

  tags = module.tag_config.tags
}

resource "aws_lambda_event_source_mapping" "config_set_processor" {
  event_source_arn = data.aws_sqs_queue.sqs_set_processor.arn
  function_name    = module.lambda_set_processor.lambda_function_arn
  #scaling_config { maximum_concurrency = 8 } # To adjust based on expected load for high priority tasks
}
