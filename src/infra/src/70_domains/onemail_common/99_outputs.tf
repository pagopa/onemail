output "dynamodb_table_names" {
  description = "DynamoDB Table Names keyed by logical table name"
  value       = { for k, v in module.dynamodb_table : k => try(v.table_name, v.dynamodb_table_name, null) }
}

output "dynamodb_table_arns" {
  description = "DynamoDB Table ARNs keyed by logical table name"
  value       = { for k, v in module.dynamodb_table : k => try(v.table_arn, v.dynamodb_table_arn, null) }
}

output "dynamodb_stream_arns" {
  description = "DynamoDB Stream ARNs keyed by logical table name"
  value       = { for k, v in module.dynamodb_table : k => try(v.table_stream_arn, v.dynamodb_table_stream_arn, null) }
}

output "attachments_bucket_name" {
  description = "Name of the private S3 bucket used to store email attachments."
  value       = module.s3_email_attachments_bucket.name
}

output "attachments_bucket_arn" {
  description = "ARN of the private S3 bucket used to store email attachments."
  value       = module.s3_email_attachments_bucket.arn
}
