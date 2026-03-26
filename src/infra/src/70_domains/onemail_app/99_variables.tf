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

variable "deploy_role_github_repository" {
  type        = string
  description = "Role to deploy ecs"
}

variable "enable_ses" {
  type        = bool
  description = "Enable SES identity-based restrictions for the sender Lambda policy. Disable it during early tests to keep broad SES permissions."
  default     = false
}

variable "lambda_set_processor" {
  type = object({
    package_path                   = string
    reserved_concurrent_executions = optional(number)
  })
}
