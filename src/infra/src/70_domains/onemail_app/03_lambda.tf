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
    resources = var.enable_ses && var.env != "dev" ? distinct(concat(
      ["arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:template/*"],
      [for tenant_key, _ in local.tenants : data.aws_ses_domain_identity.tenant[tenant_key].arn],
      [for tenant_key, _ in local.tenants : data.aws_sesv2_configuration_set.tenant_config_set[tenant_key].arn]
    )) : ["*"]


    dynamic "condition" {
      for_each = var.enable_ses && length(local.tenants) > 0 ? [1] : []

      content {
        test     = "StringEquals"
        variable = "ses:TenantName"
        values   = [for tenant in values(local.tenants) : tenant.tenant_name]
      }
    }

    dynamic "condition" {
      for_each = var.enable_ses && length(local.tenants) > 0 ? [1] : []

      content {
        test     = "StringLike"
        variable = "ses:FromAddress"
        values   = [for tenant in values(local.tenants) : "*@${tenant.domain}"]
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
      "${data.aws_dynamodb_table.EmailStatusHistory.arn}/index/${local.gsis["gsi_request_id_idx"].name}"
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
    AWS_EMAIL_DB_TABLE               = data.aws_dynamodb_table.EmailStatusHistory.name
    AWS_EMAIL_DB_REQUEST_ID_GSI      = local.gsis["gsi_request_id_idx"].name
    HIGH_PRIORITY_QUEUE_ARN          = data.aws_sqs_queue.high_priority.arn
    LOW_PRIORITY_QUEUE_ARN           = data.aws_sqs_queue.low_priority.arn
    SERVICE_PREFIX                   = "${local.project_nodomain}"
    AWS_CLOUDWATCH_METRICS_NAMESPACE = "${local.project_nodomain}-lambda-sender"
    NODE_ENV                         = "production"
    POWERTOOLS_LOG_LEVEL             = "DEBUG"
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
      "sqs:SendMessage"
    ]
    resources = [
      data.aws_sqs_queue.high_priority.arn,
      data.aws_sqs_queue.low_priority.arn
    ]
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
      "${data.aws_dynamodb_table.EmailStatusHistory.arn}/index/${local.gsis["gsi_ses_message_id_idx"].name}"
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
    AWS_CLOUDWATCH_METRICS_NAMESPACE = "${local.project_nodomain}-lambda-config-set-processor"
    SERVICE_PREFIX                   = "${local.project_nodomain}"
    NODE_ENV                         = "production"
    POWERTOOLS_LOG_LEVEL             = "DEBUG"
    SQS_HIGH_PRIORITY_QUEUE_URL      = data.aws_sqs_queue.high_priority.url
    SQS_LOW_PRIORITY_QUEUE_URL       = data.aws_sqs_queue.low_priority.url

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
