# general
prefix         = "oml"
env_short      = "p"
env            = "prod"
domain         = "onemail_com"
location       = "eu-south"
location_short = "eus1"
aws_region     = "eu-south-1"

# DynamoDB configuration for prod
dynamodb_table_config = {
  table_name                     = "EmailStatusHistory"
  hash_key                       = "emailId"
  billing_mode                   = "PAY_PER_REQUEST"
  point_in_time_recovery_enabled = true
  stream_enabled                 = true
  stream_view_type               = "NEW_AND_OLD_IMAGES"
  ttl_attribute_name             = "expiration_time"
  deletion_protection_enabled    = false
  replication_enabled            = false
  create_kms_key                 = true
  kms_alias                      = "/dynamodb/emailstatushistory"
  server_side_encryption_enabled = true
  attributes = [
    {
      name = "emailId"
      type = "S"
    },
    {
      name = "requestId"
      type = "S"
    }
  ]
  global_secondary_indexes = [
    {
      name            = "gsi_request_id_idx"
      hash_key        = "request_id"
      projection_type = "ALL"
    }
  ]
  replica_regions = []
}

# ECS Cluster
enable_container_insights = true
