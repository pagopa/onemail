resource "aws_cloudwatch_metric_alarm" "infra" {
  for_each = local.infra_alarms

  alarm_name          = each.value.alarm_name
  alarm_description   = each.value.alarm_description
  comparison_operator = each.value.comparison_operator
  evaluation_periods  = each.value.evaluation_periods
  threshold           = each.value.threshold
  metric_name         = each.value.metric_name
  namespace           = each.value.namespace
  period              = each.value.period
  statistic           = try(each.value.statistic, null)
  extended_statistic  = try(each.value.extended_statistic, null)
  alarm_actions       = local.alarm_actions
  treat_missing_data  = try(each.value.treat_missing_data, "notBreaching")
  dimensions          = each.value.dimensions
}
