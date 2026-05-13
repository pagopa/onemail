variable "prefix" {
  type        = string
  description = "Prefix for resource names."
  validation {
    condition     = length(var.prefix) <= 6
    error_message = "Max length is 6 characters."
  }
}

variable "env" {
  type        = string
  description = "Environment."
}

variable "env_short" {
  type        = string
  description = "Short environment identifier."
  validation {
    condition     = length(var.env_short) <= 1
    error_message = "Max length is 1 character"
  }
}

variable "domain" {
  type        = string
  description = "Domain name."
  validation {
    condition     = length(var.domain) <= 12
    error_message = "Max length is 12 characters"
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region."
}

variable "location_short" {
  type        = string
  description = "Location short like eg: neu, weu."
}



variable "alarm_subscribers" {
  type        = string
  description = "Email address to subscribe to SES reputation alarms."
  default     = ""
}

variable "sqs_alarm_max_age_seconds" {
  description = "Maximum allowed age, in seconds, for messages in each monitored SQS queue. Configure per environment in terraform.tfvars."

  type = object({
    high_priority        = number
    low_priority         = number
    config_set_processor = number
  })
}

variable "infra_alarm_templates" {
  description = "Template configuration for infrastructure CloudWatch alarms. Configure per environment in terraform.tfvars."

  type = map(object({
    comparison_operator = string
    evaluation_periods  = number
    threshold           = number
    metric_name         = string
    namespace           = string
    period              = number
    statistic           = optional(string)
    extended_statistic  = optional(string)
    treat_missing_data  = optional(string, "notBreaching")
  }))
}

variable "custom_alarm_config" {
  description = "Template configuration for custom application CloudWatch alarms. Configure per environment in terraform.tfvars."

  type = object({
    config_set_processor = map(object({
      comparison_operator = string
      evaluation_periods  = number
      threshold           = number
      metric_name         = string
      period              = number
      statistic           = optional(string, "Sum")
      treat_missing_data  = optional(string, "notBreaching")
      extra_dimensions    = optional(map(string), {})
    }))
    dispatcher = map(object({
      comparison_operator = string
      evaluation_periods  = number
      threshold           = number
      metric_name         = string
      period              = number
      statistic           = optional(string, "Sum")
      treat_missing_data  = optional(string, "notBreaching")
    }))
    sender = map(object({
      comparison_operator = string
      evaluation_periods  = number
      threshold           = number
      metric_name         = string
      period              = number
      statistic           = optional(string, "Sum")
      treat_missing_data  = optional(string, "notBreaching")
    }))
  })
}

variable "config_set_processor_metric_math_alarm_config" {
  description = <<-EOT
    Configuration for config-set-processor alarms that aggregate across all tenantName
    values using CloudWatch Metric Math SEARCH expressions.

    Use this variable (instead of custom_alarm_config.config_set_processor) for any
    CSP metric that carries a dynamic dimension at runtime (e.g. tenantName). The
    generated alarm uses a metric_query expression, so top-level `statistic` and
    `dimensions` are not applicable and intentionally absent from this type.

    Metrics currently published with tenantName:
      EmailHardBounce, EmailNonRetryableSoftBounce, EmailComplaint, EmailRejected,
      EmailRenderingFailure, HighPriorityMaxRetriesReached, LowPriorityMaxRetriesReached,
      ExhaustedInternalRetries.
  EOT
  type = map(object({
    comparison_operator = string
    evaluation_periods  = number
    threshold           = number
    metric_name         = string
    period              = number
    treat_missing_data  = optional(string, "notBreaching")
  }))
  default = {}
}

variable "dashboard_name" {
  type        = string
  description = "CloudWatch dashboard name."
}

variable "application_dashboard_name" {
  type        = string
  description = "CloudWatch application metrics dashboard name."
}
