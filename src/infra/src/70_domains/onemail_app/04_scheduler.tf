resource "aws_iam_role" "scheduler_role" {
  name = local.scheduler_role_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "scheduler.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy" "scheduler_sqs_policy" {
  name = "${local.project_nodomain}-scheduler-sqs-policy"
  role = aws_iam_role.scheduler_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = "sqs:SendMessage",
      Resource = [data.aws_sqs_queue.high_priority.arn, data.aws_sqs_queue.low_priority.arn]
    }]
  })
}

resource "aws_scheduler_schedule_group" "ses_retries" {
  name = local.scheduler_group_name
}
