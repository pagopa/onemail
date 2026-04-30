# Config-Set-Processor custom metric alarms
resource "aws_cloudwatch_metric_alarm" "custom_config_set_processor" {
  for_each = local.custom_alarms_config_set_processor

  alarm_name          = each.value.alarm_name
  alarm_description   = each.value.alarm_description
  comparison_operator = each.value.comparison_operator
  evaluation_periods  = each.value.evaluation_periods
  threshold           = each.value.threshold
  metric_name         = each.value.metric_name
  namespace           = each.value.namespace
  period              = each.value.period
  statistic           = each.value.statistic
  alarm_actions       = local.alarm_actions
  treat_missing_data  = each.value.treat_missing_data
  dimensions          = each.value.dimensions
}

# Dispatcher custom metric alarms 
resource "aws_cloudwatch_metric_alarm" "custom_dispatcher" {
  for_each = local.custom_alarms_dispatcher

  alarm_name          = each.value.alarm_name
  alarm_description   = each.value.alarm_description
  comparison_operator = each.value.comparison_operator
  evaluation_periods  = each.value.evaluation_periods
  threshold           = each.value.threshold
  metric_name         = each.value.metric_name
  namespace           = each.value.namespace
  period              = each.value.period
  statistic           = each.value.statistic
  alarm_actions       = local.alarm_actions
  treat_missing_data  = each.value.treat_missing_data
  dimensions          = each.value.dimensions
}
