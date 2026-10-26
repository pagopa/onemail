variable "aws_region" {
  type        = string
  description = "AWS region."
}

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

variable "template_registry_enabled" {
  type        = bool
  description = "Enable template ownership checks only after the global registry and both-region SES templates have been manually aligned."
  default     = false
}

variable "excluded_domains_regex" {
  type        = string
  description = "Regular expression matching recipient email addresses excluded by the ECS dispatcher."
}

variable "env_short" {
  type        = string
  description = "Short environment identifier."
  validation {
    condition     = length(var.env_short) <= 1
    error_message = "Max length is 1 character."
  }
}

variable "location" {
  type        = string
  description = "Location or region name."
}

variable "location_short" {
  type        = string
  description = "Location short like eg: neu, weu."
}

variable "dns_zone_name" {
  type        = string
  description = "Name of the DNS hosted zone. For prod: 'onemail.pagopa.it', for dev/uat: subdomain will be automatically prefixed."
  default     = "onemail.pagopa.it"
}

variable "domain" {
  type        = string
  description = "Domain name."
  validation {
    condition     = length(var.domain) <= 12
    error_message = "Max length is 12 characters."
  }
}

variable "openapi_template_file" {
  type        = string
  description = "Path to the OpenAPI template file."
  default     = "openapi/om.tpl.json"
}

variable "api_gateway_deployment_version" {
  type        = string
  description = "Version to trigger API Gateway redeployment."
  default     = "1.0.0"
}

variable "api_gateway_usage_plan_throttle" {
  description = "Throttle configuration applied to API Gateway usage plans."
  type = object({
    burst_limit = number
    rate_limit  = number
  })
}

variable "ecs_service_image_name" {
  type        = string
  description = "Logical ECR repository key for the ECS service image."
}

variable "ecs_service_image_version" {
  type        = string
  description = "ECS service image tag/version."
}

variable "lambda_sender" {
  type = object({
    reserved_concurrent_executions = optional(number)
    package_path                   = string
  })
}

variable "ses_multi_region_endpoint_enabled" {
  type        = bool
  description = "Whether to inject the SES multi-region endpoint id into the sender Lambda."
  default     = false
}

variable "ses_regions" {
  type        = list(string)
  description = "SES regions whose identities, templates, and configuration sets may be used by sender requests."
  default     = []

  validation {
    condition     = !var.ses_multi_region_endpoint_enabled || length(var.ses_regions) >= 2
    error_message = "Provide at least two SES regions when ses_multi_region_endpoint_enabled is true."
  }
}

variable "deploy_role_github_repository" {
  type        = string
  description = "Role to deploy ecs"
}



variable "lambda_set_processor" {
  type = object({
    package_path                   = string
    reserved_concurrent_executions = optional(number)
  })
}

variable "lambda_email_retention" {
  type = object({
    enabled                        = bool
    package_path                   = optional(string, "lambda/hello-nodejs/hello-nodejs.zip")
    reserved_concurrent_executions = optional(number)
    email_retention_days           = optional(number, 5)
    stream_trigger_enabled         = optional(bool, true)
    stream_batch_size              = optional(number, 10)
    stream_maximum_retry_attempts  = optional(number, 5)
    stream_max_record_age_seconds  = optional(number, 3600)
  })
  description = "Email retention Lambda: sets the TTL on finalized emails and deletes their S3 attachments."
  default = {
    enabled = false
  }

  validation {
    condition     = var.lambda_email_retention.email_retention_days > 0
    error_message = "email_retention_days must be greater than 0."
  }
}
