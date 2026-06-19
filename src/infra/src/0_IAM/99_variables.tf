variable "aws_region" {
  type        = string
  description = "AWS region."
}

variable "github_repository" {
  type        = string
  description = "Github federation repository"
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

variable "aws_region_short" {
  type        = string
  description = "AWS region short format."
  default     = "es-1"
}

variable "app_name" {
  type        = string
  description = "App name."
  default     = "onemail"
}

variable "lambda_code_bucket_name" {
  type        = string
  description = "Lambda code S3 bucket name."
}

variable "create_primary_region_github_iac_roles" {
  type        = bool
  description = "Whether to create account-global GitHub OIDC and Terraform plan/apply roles in this regional stack."
  default     = true
}
