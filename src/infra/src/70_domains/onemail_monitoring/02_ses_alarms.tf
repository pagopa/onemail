# --- BOUNCE RATE ALARM (> 5%) ---
resource "aws_cloudwatch_metric_alarm" "bounce_rate_per_tenant" {
  for_each            = local.tenants
  alarm_name          = "SES-High-Bounce-Rate-${each.key}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "Reputation.BounceRate"
  namespace           = "AWS/SES"
  period              = "300" # 5 minuti
  statistic           = "Average"
  threshold           = "0.05" # 5%
  alarm_description   = "The bounce rate for tenant ${each.key} has exceeded 5%."
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ConfigurationSet = "config-${each.key}"
  }
}

# --- COMPLAINT RATE ALARM (> 0.1%) ---
resource "aws_cloudwatch_metric_alarm" "complaint_rate_per_tenant" {
  for_each            = local.tenants
  alarm_name          = "SES-High-Complaint-Rate-${each.key}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "Reputation.ComplaintRate"
  namespace           = "AWS/SES"
  period              = "300"
  statistic           = "Average"
  threshold           = "0.001" # 0.1%
  alarm_description   = "The complaint rate (spam) for tenant ${each.key} has exceeded 0.1%."
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ConfigurationSet = "config-${each.key}"
  }
}
