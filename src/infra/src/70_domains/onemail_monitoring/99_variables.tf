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

variable "email_retention_alarms_enabled" {
  type        = bool
  description = "Whether to create alarms for the email retention Lambda (onemail_app). Enable it only where the Lambda is enabled."
  default     = false
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
  description = "Template configuration for config-set-processor alarms using Metrics Insights with dynamic dimensions (tenantName, clientId). Configure per environment in terraform.tfvars."
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

variable "metrics_archive" {
  description = <<-EOT
    Long-term archive of custom email metrics: CloudWatch metric stream -> Firehose -> S3, queryable with Athena.
    The hosting region (archive_location_short unset) owns the bucket, Glue table and Athena and lists source_regions;
    other regions set archive_location_short and only stream their metrics into the hosting region bucket.
  EOT
  type = object({
    enabled                = bool
    namespace              = optional(string)
    metric_names           = optional(list(string), [])
    partition_start_date   = optional(string, "2025-01-01")
    source_regions         = optional(list(string), [])
    archive_location_short = optional(string)
  })
  default = {
    enabled = false
  }

  validation {
    condition     = !var.metrics_archive.enabled || try(length(trimspace(var.metrics_archive.namespace)) > 0, false)
    error_message = "metrics_archive.namespace is required when metrics_archive.enabled is true."
  }

  validation {
    condition     = !var.metrics_archive.enabled || length(var.metrics_archive.metric_names) > 0
    error_message = "metrics_archive.metric_names must list at least one metric when metrics_archive.enabled is true."
  }

  validation {
    condition     = !var.metrics_archive.enabled || var.metrics_archive.archive_location_short != null || contains(var.metrics_archive.source_regions, var.aws_region)
    error_message = "In the hosting region metrics_archive.source_regions must include aws_region."
  }
}
