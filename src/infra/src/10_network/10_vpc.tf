module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.5.1"

  name                  = "${local.project}-vpc"
  cidr                  = var.vpc_cidr
  azs                   = var.azs
  private_subnets       = var.vpc_private_subnets_cidr
  private_subnet_suffix = "private"
  public_subnets        = var.vpc_public_subnets_cidr
  public_subnet_suffix  = "public"
  intra_subnets         = var.vpc_internal_subnets_cidr

  enable_nat_gateway = var.enable_nat_gateway
  single_nat_gateway = var.single_nat_gateway

  enable_dns_hostnames = true
  enable_dns_support   = true

  #   enable_flow_log                      = true
  #   create_flow_log_cloudwatch_log_group = true
  #   create_flow_log_cloudwatch_iam_role  = true

  tags = module.tag_config.tags
}

resource "aws_security_group" "vpce_tls" {
  name_prefix = "${local.project}-vpce-tls-"
  description = "Allow TLS from VPC workloads to interface endpoints"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "TLS from VPC CIDR"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }

  tags = merge(module.tag_config.tags, { Name = "${local.project}-vpce-tls" })
}

module "vpc_endpoints" {
  source  = "terraform-aws-modules/vpc/aws//modules/vpc-endpoints"
  version = "6.5.1"

  vpc_id = module.vpc.vpc_id

  endpoints = {
    s3 = {
      service         = "s3"
      service_type    = "Gateway"
      route_table_ids = flatten([module.vpc.intra_route_table_ids, module.vpc.private_route_table_ids, module.vpc.public_route_table_ids])
      tags            = { Name = "${local.project}-s3-vpc-endpoint" }
    }

    dynamodb = {
      service         = "dynamodb"
      service_type    = "Gateway"
      route_table_ids = flatten([module.vpc.intra_route_table_ids, module.vpc.private_route_table_ids, module.vpc.public_route_table_ids])
      tags            = { Name = "${local.project}-dynamodb-vpc-endpoint" }
    }

    logs = {
      service             = "logs"
      private_dns_enabled = true
      subnet_ids          = module.vpc.private_subnets
      security_group_ids  = [aws_security_group.vpce_tls.id]
      tags                = { Name = "${local.project}-logs-endpoint" }
    }

    monitoring = {
      service             = "monitoring"
      private_dns_enabled = true
      subnet_ids          = module.vpc.private_subnets
      security_group_ids  = [aws_security_group.vpce_tls.id]
      tags                = { Name = "${local.project}-monitoring-endpoint" }
    }

    ecr_api = {
      service             = "ecr.api"
      private_dns_enabled = true
      subnet_ids          = module.vpc.private_subnets
      security_group_ids  = [aws_security_group.vpce_tls.id]
      tags                = { Name = "${local.project}-ecr-api-endpoint" }
    }

    ecr_dkr = {
      service             = "ecr.dkr"
      private_dns_enabled = true
      subnet_ids          = module.vpc.private_subnets
      security_group_ids  = [aws_security_group.vpce_tls.id]
      tags                = { Name = "${local.project}-ecr-dkr-endpoint" }
    }

    kms = {
      service             = "kms"
      private_dns_enabled = true
      subnet_ids          = module.vpc.private_subnets
      security_group_ids  = [aws_security_group.vpce_tls.id]
      tags                = { Name = "${local.project}-kms-endpoint" }
    }

    ssm = {
      service             = "ssm"
      private_dns_enabled = true
      subnet_ids          = module.vpc.private_subnets
      security_group_ids  = [aws_security_group.vpce_tls.id]
      tags                = { Name = "${local.project}-ssm-endpoint" }
    }

    apigw = {
      service             = "execute-api"
      private_dns_enabled = true
      subnet_ids          = module.vpc.private_subnets
      security_group_ids  = [aws_security_group.vpce_tls.id]
      tags                = { Name = "${local.project}-apigw-endpoint" }
    }

    sqs = {
      service             = "sqs"
      private_dns_enabled = true
      subnet_ids          = module.vpc.private_subnets
      security_group_ids  = [aws_security_group.vpce_tls.id]
      tags                = { Name = "${local.project}-sqs-endpoint" }
    }

    email = {
      service             = "email"
      private_dns_enabled = true
      subnet_ids          = module.vpc.private_subnets
      security_group_ids  = [aws_security_group.vpce_tls.id]
      tags                = { Name = "${local.project}-email-endpoint" }
    }
  }

  tags = module.tag_config.tags
}
