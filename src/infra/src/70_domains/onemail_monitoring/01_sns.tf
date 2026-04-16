data "aws_ssm_parameter" "alarm_subscribers" {
  count = var.alarm_subscribers != "" ? 1 : 0
  name  = var.alarm_subscribers
}

resource "aws_sns_topic" "alerts" {
  count        = var.alarm_subscribers != "" ? 1 : 0
  name         = "${local.project_nodomain}-sns"
  display_name = "Alarms"
}

resource "aws_sns_topic_subscription" "email_alert" {
  count                  = var.alarm_subscribers != "" ? length(local.emails) : 0
  endpoint               = local.emails[count.index]
  topic_arn              = aws_sns_topic.alerts[0].arn
  protocol               = "email"
  endpoint_auto_confirms = true
}
