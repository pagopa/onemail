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

# Sender custom metric alarms
resource "aws_cloudwatch_metric_alarm" "custom_sender" {
  for_each = local.custom_alarms_sender

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

# CSP ExhaustedInternalRetries alarm (metric math: SUM across all clientId dimensions)
resource "aws_cloudwatch_metric_alarm" "exhausted_internal_retries" {
  alarm_name          = "${local.project_nodomain}-csp-ExhaustedInternalRetries"
  alarm_description   = "The config-set-processor exceeded max internal SQS retries at least ${var.exhausted_internal_retries_alarm.threshold} time(s) in the last ${var.exhausted_internal_retries_alarm.period / 60} minutes."
  comparison_operator = var.exhausted_internal_retries_alarm.comparison_operator
  evaluation_periods  = var.exhausted_internal_retries_alarm.evaluation_periods
  threshold           = var.exhausted_internal_retries_alarm.threshold
  alarm_actions       = local.alarm_actions
  treat_missing_data  = var.exhausted_internal_retries_alarm.treat_missing_data

  metric_query {
    id          = "total"
    expression  = "SUM(SEARCH('{${local.project_nodomain},service,clientId} MetricName=\"ExhaustedInternalRetries\" service=\"${local.project_nodomain}-lambda-config-set-processor\"', 'Sum', ${var.exhausted_internal_retries_alarm.period}))"
    label       = "ExhaustedInternalRetries (all clients)"
    return_data = true
  }
}
