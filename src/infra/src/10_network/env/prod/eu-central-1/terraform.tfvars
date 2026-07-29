# general
prefix         = "oml"
env_short      = "p"
env            = "prod"
domain         = "network"
location_short = "euc1"
aws_region     = "eu-central-1"

# VPC Configuration
vpc_cidr                  = "10.2.0.0/16"
azs                       = ["eu-central-1a", "eu-central-1b", "eu-central-1c"]
vpc_private_subnets_cidr  = ["10.2.80.0/20", "10.2.64.0/20", "10.2.48.0/20"]
vpc_public_subnets_cidr   = ["10.2.120.0/21", "10.2.112.0/21", "10.2.104.0/21"]
vpc_internal_subnets_cidr = ["10.2.32.0/20", "10.2.16.0/20", "10.2.0.0/20"]
enable_nat_gateway        = true
single_nat_gateway        = true

# Shared DNS and Global Accelerator resources stay in the primary region
create_primary_region_public_entrypoint = false

# Waf configuration
web_acl = {
  cloudwatch_metrics_enabled = true
  sampled_requests_enabled   = true
}

enable_ses_dns_records = true

alb_ssl_policy = "ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09"
