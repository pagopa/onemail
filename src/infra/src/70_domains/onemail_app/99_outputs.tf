output "dynamodb_table_name" {
  description = "DynamoDB Table Name"
  value       = try(module.dynamodb_table[0].dynamodb_table_name, null)
}

output "dynamodb_table_arn" {
  description = "DynamoDB Table ARN"
  value       = try(module.dynamodb_table[0].dynamodb_table_arn, null)
}

output "dynamodb_stream_arn" {
  description = "DynamoDB Stream ARN"
  value       = try(module.dynamodb_table[0].dynamodb_table_stream_arn, null)
}
