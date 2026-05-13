data "aws_iam_policy_document" "alb_waf_logging" {
  version = "2012-10-17"
  statement {
    effect = "Allow"
    principals {
      identifiers = ["delivery.logs.amazonaws.com"]
      type        = "Service"
    }
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.waf_logs.arn}:*"]
    condition {
      test     = "ArnLike"
      values   = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
      variable = "aws:SourceArn"
    }
    condition {
      test     = "StringEquals"
      values   = [tostring(data.aws_caller_identity.current.account_id)]
      variable = "aws:SourceAccount"
    }
  }
}


data "aws_caller_identity" "current" {}
