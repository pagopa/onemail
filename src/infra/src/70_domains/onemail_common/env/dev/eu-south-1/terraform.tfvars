# general
prefix         = "oml"
env_short      = "d"
env            = "dev"
domain         = "onemail_com"
location       = "eu-south"
location_short = "eus1"
aws_region     = "eu-south-1"

# DynamoDB configuration for dev
dynamodb_tables = {
  email_status_history = {
    table_name                     = "EmailStatusHistory"
    hash_key                       = "emailId"
    billing_mode                   = "PAY_PER_REQUEST"
    point_in_time_recovery_enabled = false
    stream_enabled                 = false
    stream_view_type               = "NEW_AND_OLD_IMAGES"
    ttl_attribute_name             = "expiration_time"
    deletion_protection_enabled    = false
    replication_enabled            = true
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
      },
      {
        name = "providerMessageId"
        type = "S"
      }
    ]
    global_secondary_indexes = [
      {
        name            = "gsi_request_id_idx"
        hash_key        = "requestId"
        projection_type = "ALL"
      },
      {
        name            = "gsi_provider_message_id_idx"
        hash_key        = "providerMessageId"
        projection_type = "ALL"
      }
    ]
    replica_regions = []
  }
  tenant_config = {
    table_name                     = "TenantConfig"
    hash_key                       = "clientId"
    billing_mode                   = "PAY_PER_REQUEST"
    point_in_time_recovery_enabled = false
    stream_enabled                 = false
    stream_view_type               = "NEW_AND_OLD_IMAGES"
    ttl_attribute_name             = "expiration_time"
    deletion_protection_enabled    = false
    replication_enabled            = false
    create_kms_key                 = true
    kms_alias                      = "/dynamodb/tenantconfig"
    server_side_encryption_enabled = true
    attributes = [
      {
        name = "clientId"
        type = "S"
      },
      {
        name = "tenantName"
        type = "S"
      }
    ]
    global_secondary_indexes = [
      {
        name            = "gsi_tenant_name_idx"
        hash_key        = "tenantName"
        projection_type = "ALL"
      }
    ]
    replica_regions = []
  }
}

# ECS Cluster
enable_container_insights = false
