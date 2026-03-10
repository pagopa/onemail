resource "random_integer" "bucket_lambda_code_suffix" {
  min = 1000
  max = 9999
}

module "s3_lambda_code_bucket" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "4.1.1"

  bucket = local.bucket_lambda_code
  acl    = "private"

  control_object_ownership = true
  object_ownership         = "ObjectWriter"

  tags = {
    Name = local.bucket_lambda_code
  }
}
