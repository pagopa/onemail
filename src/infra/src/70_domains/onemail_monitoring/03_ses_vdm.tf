resource "aws_sesv2_account_vdm_attributes" "vdm" {
  vdm_enabled = "ENABLED"
  dashboard_attributes {
    engagement_metrics = "ENABLED"
  }
  guardian_attributes {
    optimized_shared_delivery = "ENABLED"
  }
}
