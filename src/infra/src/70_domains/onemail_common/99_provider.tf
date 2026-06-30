terraform {
  required_version = ">= 1.14.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.35.0"
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
