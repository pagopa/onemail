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

variable "domain" {
  type        = string
  description = "Domain name."
  validation {
    condition     = length(var.domain) <= 12
    error_message = "Max length is 12 characters."
  }
}

# DynamoDB table configuration
variable "dynamodb_table_config" {
  type = object({
    table_name = string
    hash_key   = string
    range_key  = optional(string)
    attributes = list(object({
      name = string
      type = string
    }))
    billing_mode                   = optional(string)
    point_in_time_recovery_enabled = optional(bool)
    stream_enabled                 = optional(bool)
    stream_view_type               = optional(string)
    ttl_attribute_name             = optional(string)
    deletion_protection_enabled    = optional(bool)
    create_kms_key                 = optional(bool)
    kms_alias                      = optional(string)
    server_side_encryption_enabled = optional(bool)
    replication_enabled            = optional(bool)
    global_secondary_indexes = optional(list(object({
      name            = string
      hash_key        = string
      projection_type = string
    })))
    replica_regions = optional(list(object({
      region_name = string
    })))
  })
  description = "DynamoDB table configuration"
}

# ECS Cluster configuration
variable "enable_container_insights" {
  type = bool
}

variable "dns_zone_name" {
  type        = string
  description = "Name of the DNS hosted zone. For prod: 'onemail.pagopa.it', for dev/uat: subdomain will be automatically prefixed."
  default     = "onemail.pagopa.it"
}

variable "enable_ses" {
  type        = bool
  description = "Whether to enable SES-related resources for this domain."
  default     = false
}
