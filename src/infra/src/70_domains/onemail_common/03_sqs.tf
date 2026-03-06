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


# resource "aws_lambda_event_source_mapping" "high_trigger" {
#   event_source_arn = aws_sqs_queue.high_priority.arn
#   function_name    = aws_lambda_function.worker.arn
#   scaling_config { maximum_concurrency = 8 } # To adjust based on expected load for high priority tasks
# }

# resource "aws_lambda_event_source_mapping" "low_trigger" {
#   event_source_arn = aws_sqs_queue.low_priority.arn
#   function_name    = aws_lambda_function.worker.arn
#   scaling_config { maximum_concurrency = 2 } # To adjust based on expected load for low priority tasks
# }
