# general
prefix         = "oml"
env_short      = "d"
env            = "dev"
domain         = "onemail_app"
location       = "eu-south"
location_short = "eus1"
aws_region     = "eu-south-1"

# DynamoDB configuration for dev
dynamodb_table_config = {
  table_name                         = "EmailStatusHistory"
  hash_key                           = "EmailId"
  billing_mode                       = "PAY_PER_REQUEST"
  point_in_time_recovery_enabled     = false
  stream_enabled                     = false
  stream_view_type                   = "NEW_AND_OLD_IMAGES"
  ttl_attribute_name                 = "expiration_time"
  deletion_protection_enabled        = false
  attributes = [
    {
      name = "EmailId"
      type = "S"
    }
  ]
  global_secondary_indexes = []
  replica_regions           = []
}
