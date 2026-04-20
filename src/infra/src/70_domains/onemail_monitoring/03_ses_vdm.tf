resource "aws_sesv2_account_vdm_attributes" "vdm" {
  count       = var.enable_ses ? 1 : 0
  vdm_enabled = "ENABLED"
  dashboard_attributes {
    engagement_metrics = "ENABLED"
  }
  guardian_attributes {
    optimized_shared_delivery = "ENABLED"
  }
}
