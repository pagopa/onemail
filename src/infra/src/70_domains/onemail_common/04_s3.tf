module "s3_code_bucket" {
  source = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/s3_bucket?ref=main"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"
  name               = "${local.project_nodomain}-lambda-code-deploy"
  tags               = module.tag_config.tags
}

module "s3_email_attachments_bucket" {
  source = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/s3_bucket?ref=main"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"
  name               = "${local.project_nodomain}-email-attachments"
  tags               = module.tag_config.tags

  # Safety net for attachments not removed by the email retention Lambda.
  # With expiration days on a versioned bucket, S3 also removes expired delete markers.
  lifecycle_rule = var.email_retention.enabled ? [
    {
      id                                     = "expire-email-attachments"
      enabled                                = true
      abort_incomplete_multipart_upload_days = 1
      expiration = {
        days = var.email_retention.attachments_expiration_days
      }
      noncurrent_version_expiration = {
        days = var.email_retention.attachments_noncurrent_expiration_days
      }
    }
  ] : null
}
