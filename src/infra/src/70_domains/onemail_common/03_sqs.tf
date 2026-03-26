resource "aws_sqs_queue" "high_priority" {
  name                       = "${local.project_nodomain}-sqs-high-priority"
  sqs_managed_sse_enabled    = true
  visibility_timeout_seconds = 60 # It should be 6x the lambda timeout(10s) to allow for retries
}

resource "aws_sqs_queue" "low_priority" {
  name                       = "${local.project_nodomain}-sqs-low-priority"
  sqs_managed_sse_enabled    = true
  visibility_timeout_seconds = 60 # It should be 6x the lambda timeout(10s) to allow for retries
}

resource "aws_sqs_queue" "sqs_set_processor" {
  name                       = "${local.project_nodomain}-sqs-config-set-processor"
  sqs_managed_sse_enabled    = true
  visibility_timeout_seconds = 60
}
