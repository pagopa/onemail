terraform {
  required_version = ">= 1.5.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.26.0"
    }
    external = {
      source  = "hashicorp/external"
      version = "~> 2.3"
    }
  }

  backend "s3" {}
}

provider "aws" {
  region = var.aws_region
}

module "aws_modules" {
  source = "git::https://github.com/pagopa/technology-aws-modules.git?ref=main"
}
