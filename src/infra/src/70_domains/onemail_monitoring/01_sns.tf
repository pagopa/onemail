resource "aws_sns_topic" "alerts" {
  name = "${local.project_nodomain}-${var.alarm_subscribers}"
}

resource "aws_sns_topic_subscription" "email_alert" {
  topic_arn              = aws_sns_topic.alerts.arn
  protocol               = "email"
  endpoint               = "TODO"
  endpoint_auto_confirms = true
}
