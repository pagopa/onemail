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

variable "domain" {
  type        = string
  description = "Domain name."
  validation {
    condition     = length(var.domain) <= 12
    error_message = "Max length is 12 characters."
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
