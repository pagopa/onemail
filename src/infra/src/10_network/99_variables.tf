variable "aws_region" {
  type        = string
  description = "AWS region."
}

variable "secondary_aws_region" {
  type        = string
  description = "Secondary AWS region used by the primary-region Global Accelerator stack to discover an additional ALB endpoint."
  default     = null
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

variable "location_short" {
  type        = string
  description = "Location short like eg: neu, weu."
}

variable "secondary_location_short" {
  type        = string
  description = "Secondary location short used by the primary-region Global Accelerator stack to discover an additional ALB endpoint."
  default     = null
}

variable "domain" {
  type        = string
  description = "Domain name."
  validation {
    condition     = length(var.domain) <= 12
    error_message = "Max length is 12 characters."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "VPC cidr."
}

variable "azs" {
  type        = list(string)
  description = "Availability zones."
}

variable "vpc_private_subnets_cidr" {
  type        = list(string)
  description = "Private subnets list of cidr."
}

variable "vpc_public_subnets_cidr" {
  type        = list(string)
  description = "Public subnets list of cidr."
}

variable "vpc_internal_subnets_cidr" {
  type        = list(string)
  description = "Internal subnets list of cidr. Mainly for private endpoints."
}

variable "enable_nat_gateway" {
  type        = bool
  description = "Enable/Create nat gateway."
  default     = false
}

variable "single_nat_gateway" {
  type        = bool
  description = "Create just one natgateway."
  default     = false
}

# DNS Configuration
variable "dns_zone_name" {
  type        = string
  description = "Name of the DNS hosted zone. For prod: 'onemail.pagopa.it', for dev/uat: subdomain will be automatically prefixed."
  default     = "onemail.pagopa.it"
}

variable "enable_ses_dns_records" {
  type        = bool
  description = "Enable SES-related DNS records and SES data lookups only for tenants allowlisted in the network stack. Set to true only after SES resources are created in onemail_common."
  default     = false
}

variable "create_primary_region_public_entrypoint" {
  type        = bool
  description = "Whether to create shared public-entrypoint resources that must stay in the primary region, such as Route53 public records, SES DNS records, and Global Accelerator."
  default     = true
}

variable "web_acl" {
  type = object({
    cloudwatch_metrics_enabled = optional(bool, false)
    sampled_requests_enabled   = optional(bool, false)
  })
  description = "WEB acl configuration"
}

variable "alb_ssl_policy" {
  type        = string
  description = "ALB Listener security policy"
}
