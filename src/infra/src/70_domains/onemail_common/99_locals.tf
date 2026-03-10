locals {
  project            = "${var.prefix}-${var.env_short}-${var.location_short}-${var.domain}"
  project_nodomain   = "${var.prefix}-${var.env_short}-${var.location_short}"
  product            = "${var.prefix}-${var.env_short}"
  bucket_lambda_code = "lambda-code-${random_integer.bucket_lambda_code_suffix.result}"
}
