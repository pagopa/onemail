# Config-Set-Processor custom metric alarms (metrics without tenantName dimension)
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

  lifecycle {
    create_before_destroy = true
  }
}

# Config-Set-Processor Metric Math alarms (metrics with tenantName dimension — aggregated across all tenants)
resource "aws_cloudwatch_metric_alarm" "csp_metric_math" {
  for_each = local.custom_alarms_config_set_processor_metric_math

  alarm_name          = each.value.alarm_name
  alarm_description   = each.value.alarm_description
  comparison_operator = each.value.comparison_operator
  evaluation_periods  = each.value.evaluation_periods
  threshold           = each.value.threshold
  alarm_actions       = local.alarm_actions
  treat_missing_data  = each.value.treat_missing_data

  dynamic "metric_query" {
    for_each = local.tenants
    content {
      id          = "m_${replace(metric_query.key, "-", "_")}"
      return_data = false
      metric {
        namespace   = local.project_nodomain
        metric_name = each.value.metric_name
        period      = each.value.period
        stat        = "Sum"
        dimensions = {
          service    = "${local.project_nodomain}-lambda-config-set-processor"
          tenantName = metric_query.value.tenant_name
        }
      }
    }
  }

  metric_query {
    id          = "total"
    expression  = each.value.sum_expression
    label       = each.value.alarm_name
    return_data = true
  }

  lifecycle {
    precondition {
      condition = length(setintersection(
        toset([for v in var.custom_alarm_config.config_set_processor : v.metric_name]),
        toset([for v in var.config_set_processor_metric_math_alarm_config : v.metric_name])
      )) == 0
      error_message = "Duplicate metric_name between custom_alarm_config.config_set_processor and config_set_processor_metric_math_alarm_config — each metric must belong to exactly one alarm type."
    }
    precondition {
      condition     = length(local.tenants) > 0
      error_message = "config_set_processor_metric_math_alarm_config requires at least one tenant to be configured."
    }
    create_before_destroy = true
  }
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

  lifecycle {
    create_before_destroy = true
  }
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

  lifecycle {
    create_before_destroy = true
  }
}
