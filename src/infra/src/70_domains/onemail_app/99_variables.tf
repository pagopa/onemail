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

variable "dynamodb_enable_replication" {
  type        = bool
  description = "Enable DynamoDB replication."
  default     = false
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
    billing_mode                   = optional(string, "PAY_PER_REQUEST")
    point_in_time_recovery_enabled = optional(bool, true)
    stream_enabled                 = optional(bool, true)
    stream_view_type               = optional(string, "NEW_AND_OLD_IMAGES")
    ttl_attribute_name             = optional(string)
    deletion_protection_enabled    = optional(bool, false)
    create_kms_key                 = optional(bool, false)
    kms_alias                      = optional(string)
    server_side_encryption_enabled = optional(bool, false)
    replica_regions = optional(list(object({
      region_name = string
    })), [])
  })
  description = "DynamoDB table configuration"
  default     = null
}
