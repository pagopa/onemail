# general
prefix         = "oml"
env_short      = "u"
env            = "uat"
domain         = "onemail_com"
location       = "eu-south"
location_short = "eus1"
aws_region     = "eu-south-1"


alarm_subscribers = "alarm-subscribers"

sqs_alarm_max_age_seconds = {
  high_priority        = 180
  low_priority         = 1200
  config_set_processor = 420
}

infra_alarm_templates = {
  sqs_oldest_message_age = {
    comparison_operator = "GreaterThanOrEqualToThreshold"
    evaluation_periods  = 1
    threshold           = 420
    metric_name         = "ApproximateAgeOfOldestMessage"
    namespace           = "AWS/SQS"
    period              = 300
    statistic           = "Maximum"
    treat_missing_data  = "notBreaching"
  }
  lambda_errors = {
    comparison_operator = "GreaterThanOrEqualToThreshold"
    evaluation_periods  = 1
    threshold           = 2
    metric_name         = "Errors"
    namespace           = "AWS/Lambda"
    period              = 300
    statistic           = "Sum"
    treat_missing_data  = "notBreaching"
  }
  lambda_throttles = {
    comparison_operator = "GreaterThanOrEqualToThreshold"
    evaluation_periods  = 1
    threshold           = 2
    metric_name         = "Throttles"
    namespace           = "AWS/Lambda"
    period              = 300
    statistic           = "Sum"
    treat_missing_data  = "notBreaching"
  }
  ses_rule_failed_invocations = {
    comparison_operator = "GreaterThanOrEqualToThreshold"
    evaluation_periods  = 1
    threshold           = 2
    metric_name         = "FailedInvocations"
    namespace           = "AWS/Events"
    period              = 300
    statistic           = "Sum"
    treat_missing_data  = "notBreaching"
  }
  ecs_running_task_count = {
    comparison_operator = "LessThanThreshold"
    evaluation_periods  = 2
    threshold           = 1
    metric_name         = "RunningTaskCount"
    namespace           = "ECS/ContainerInsights"
    period              = 300
    statistic           = "Minimum"
    treat_missing_data  = "missing"
  }
  ecs_high_cpu_utilization = {
    comparison_operator = "GreaterThanOrEqualToThreshold"
    evaluation_periods  = 3
    threshold           = 90
    metric_name         = "CPUUtilization"
    namespace           = "AWS/ECS"
    period              = 300
    statistic           = "Average"
    treat_missing_data  = "notBreaching"
  }
  ecs_high_memory_utilization = {
    comparison_operator = "GreaterThanOrEqualToThreshold"
    evaluation_periods  = 3
    threshold           = 90
    metric_name         = "MemoryUtilization"
    namespace           = "AWS/ECS"
    period              = 300
    statistic           = "Average"
    treat_missing_data  = "notBreaching"
  }
  api_gateway_5xx_errors = {
    comparison_operator = "GreaterThanOrEqualToThreshold"
    evaluation_periods  = 1
    threshold           = 5
    metric_name         = "5XXError"
    namespace           = "AWS/ApiGateway"
    period              = 300
    statistic           = "Sum"
    treat_missing_data  = "notBreaching"
  }
  api_gateway_high_latency = {
    comparison_operator = "GreaterThanOrEqualToThreshold"
    evaluation_periods  = 3
    threshold           = 5000
    metric_name         = "Latency"
    namespace           = "AWS/ApiGateway"
    period              = 300
    extended_statistic  = "p95"
    treat_missing_data  = "notBreaching"
  }
}

custom_alarm_config = {
  config_set_processor = {
    email_hard_bounce = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 2
      metric_name         = "EmailHardBounce"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    email_complaint = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 2
      metric_name         = "EmailComplaint"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    email_rejected = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 2
      metric_name         = "EmailRejected"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    email_rendering_failure = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 5
      metric_name         = "EmailRenderingFailure"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    high_priority_max_retries_reached = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 1
      metric_name         = "HighPriorityMaxRetriesReached"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    low_priority_max_retries_reached = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 5
      metric_name         = "LowPriorityMaxRetriesReached"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    schedule_retry_failed = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 1
      metric_name         = "ScheduleRetryFailed"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    email_non_retryable_soft_bounce = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 5
      metric_name         = "EmailNonRetryableSoftBounce"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    invalid_record = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 3
      metric_name         = "InvalidRecord"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    email_not_found = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 3
      metric_name         = "EmailNotFound"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    unexpected_retryable_error = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 3
      metric_name         = "UnexpectedRetryableError"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
  }
  dispatcher = {
    multiple_tenant_for_client = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 1
      metric_name         = "MultipleTenantForClient"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    tenant_configuration_not_found = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 1
      metric_name         = "TenantConfigurationNotFound"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    unauthorized_tenant = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 1
      metric_name         = "UnauthorizedTenant"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
  }
  sender = {
    high_priority_rejected = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 1
      metric_name         = "HighPriorityRejected"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    low_priority_rejected = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 5
      metric_name         = "LowPriorityRejected"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    email_status_batch_update_failed = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 1
      metric_name         = "EmailStatusBatchUpdateFailed"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    invalid_record = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 3
      metric_name         = "InvalidRecord"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    email_not_found = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 3
      metric_name         = "EmailNotFound"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    email_batch_not_found = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 3
      metric_name         = "EmailBatchNotFound"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    unexpected_retryable_error = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 3
      metric_name         = "UnexpectedRetryableError"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    high_priority_exhausted_retries = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 1
      metric_name         = "HighPriorityExhaustedInternalRetries"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
    low_priority_exhausted_retries = {
      comparison_operator = "GreaterThanOrEqualToThreshold"
      evaluation_periods  = 1
      threshold           = 3
      metric_name         = "LowPriorityExhaustedInternalRetries"
      period              = 300
      statistic           = "Sum"
      treat_missing_data  = "notBreaching"
    }
  }
}

dashboard_name             = "overall-dashboard"
application_dashboard_name = "application-dashboard"

exhausted_internal_retries_alarm = {
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  period              = 300
  treat_missing_data  = "notBreaching"
}
