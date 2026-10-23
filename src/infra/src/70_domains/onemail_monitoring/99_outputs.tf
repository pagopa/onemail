output "metrics_archive_bucket_name" {
  description = "S3 bucket holding the archived email metrics (stream and backfill)."
  value       = try(module.s3_metrics_archive_bucket[0].name, null)
}

output "metrics_archive_athena_workgroup" {
  description = "Athena workgroup to query the archived email metrics."
  value       = try(aws_athena_workgroup.metrics_archive[0].name, null)
}
