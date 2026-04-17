output "dynamodb_table_names" {
  description = "DynamoDB Table Names keyed by logical table name"
  value       = { for k, v in module.dynamodb_table : k => v.dynamodb_table_name }
}

output "dynamodb_table_arns" {
  description = "DynamoDB Table ARNs keyed by logical table name"
  value       = { for k, v in module.dynamodb_table : k => v.dynamodb_table_arn }
}

output "dynamodb_stream_arns" {
  description = "DynamoDB Stream ARNs keyed by logical table name"
  value       = { for k, v in module.dynamodb_table : k => v.dynamodb_table_stream_arn }
}
