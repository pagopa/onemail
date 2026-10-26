module "s3_metrics_archive_bucket" {
  count  = local.metrics_archive_is_host ? 1 : 0
  source = "git::https://github.com/pagopa/technology-aws-modules.git//IDVH/s3_bucket?ref=main"

  env                = var.env
  product_name       = "onemail"
  idvh_resource_tier = "standard"
  name               = local.metrics_archive_name
  tags               = module.tag_config.tags
}

# --- Metric stream -> Firehose -> S3 of the hosting region (daily partitions, no expiration) ---

data "aws_iam_policy_document" "metrics_archive_firehose_assume" {
  count = var.metrics_archive.enabled ? 1 : 0

  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["firehose.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "metrics_archive_firehose" {
  count = var.metrics_archive.enabled ? 1 : 0

  name               = "${local.metrics_archive_name}-firehose"
  assume_role_policy = data.aws_iam_policy_document.metrics_archive_firehose_assume[0].json
  tags               = module.tag_config.tags
}

data "aws_iam_policy_document" "metrics_archive_firehose" {
  count = var.metrics_archive.enabled ? 1 : 0

  statement {
    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
    ]
    resources = [local.metrics_archive_bucket_arn]
  }

  statement {
    actions = [
      "s3:AbortMultipartUpload",
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = [
      "${local.metrics_archive_bucket_arn}/metrics/source=stream/${var.aws_region}/*",
      "${local.metrics_archive_bucket_arn}/errors/${var.aws_region}/*",
    ]
  }
}

resource "aws_iam_role_policy" "metrics_archive_firehose" {
  count = var.metrics_archive.enabled ? 1 : 0

  name   = "${local.metrics_archive_name}-firehose"
  role   = aws_iam_role.metrics_archive_firehose[0].id
  policy = data.aws_iam_policy_document.metrics_archive_firehose[0].json
}

resource "aws_kinesis_firehose_delivery_stream" "metrics_archive" {
  count = var.metrics_archive.enabled ? 1 : 0

  name        = local.metrics_archive_name
  destination = "extended_s3"

  server_side_encryption {
    enabled = true
  }

  extended_s3_configuration {
    role_arn            = aws_iam_role.metrics_archive_firehose[0].arn
    bucket_arn          = local.metrics_archive_bucket_arn
    prefix              = "metrics/source=stream/${var.aws_region}/!{partitionKeyFromQuery:metric_name}/dt=!{partitionKeyFromQuery:dt}/"
    error_output_prefix = "errors/${var.aws_region}/!{firehose:error-output-type}/dt=!{timestamp:yyyy-MM-dd}/"
    buffering_size      = 64
    buffering_interval  = 300
    compression_format  = "GZIP"

    dynamic_partitioning_configuration {
      enabled = true
    }

    processing_configuration {
      enabled = true

      # Metric stream records hold several newline-delimited JSON datapoints: split them before partitioning.
      processors {
        type = "RecordDeAggregation"
        parameters {
          parameter_name  = "SubRecordType"
          parameter_value = "JSON"
        }
      }

      # dt comes from the metric timestamp, not the arrival time, so it matches the backfill layout.
      processors {
        type = "MetadataExtraction"
        parameters {
          parameter_name  = "JsonParsingEngine"
          parameter_value = "JQ-1.6"
        }
        parameters {
          parameter_name  = "MetadataExtractionQuery"
          parameter_value = "{metric_name: .metric_name, dt: (.timestamp / 1000 | floor | strftime(\"%Y-%m-%d\"))}"
        }
      }

      processors {
        type = "AppendDelimiterToRecord"
      }
    }
  }

  tags = module.tag_config.tags
}

data "aws_iam_policy_document" "metrics_archive_stream_assume" {
  count = var.metrics_archive.enabled ? 1 : 0

  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["streams.metrics.cloudwatch.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "metrics_archive_stream" {
  count = var.metrics_archive.enabled ? 1 : 0

  name               = "${local.metrics_archive_name}-stream"
  assume_role_policy = data.aws_iam_policy_document.metrics_archive_stream_assume[0].json
  tags               = module.tag_config.tags
}

data "aws_iam_policy_document" "metrics_archive_stream" {
  count = var.metrics_archive.enabled ? 1 : 0

  statement {
    actions = [
      "firehose:PutRecord",
      "firehose:PutRecordBatch",
    ]
    resources = [aws_kinesis_firehose_delivery_stream.metrics_archive[0].arn]
  }
}

resource "aws_iam_role_policy" "metrics_archive_stream" {
  count = var.metrics_archive.enabled ? 1 : 0

  name   = "${local.metrics_archive_name}-stream"
  role   = aws_iam_role.metrics_archive_stream[0].id
  policy = data.aws_iam_policy_document.metrics_archive_stream[0].json
}

resource "aws_cloudwatch_metric_stream" "metrics_archive" {
  count = var.metrics_archive.enabled ? 1 : 0

  name          = local.metrics_archive_name
  role_arn      = aws_iam_role.metrics_archive_stream[0].arn
  firehose_arn  = aws_kinesis_firehose_delivery_stream.metrics_archive[0].arn
  output_format = "json"

  include_filter {
    namespace    = var.metrics_archive.namespace
    metric_names = var.metrics_archive.metric_names
  }

  tags = module.tag_config.tags

  depends_on = [aws_iam_role_policy.metrics_archive_stream]
}

# --- Glue catalog + Athena (hosting region only, covers every source region) ---

resource "aws_glue_catalog_database" "metrics_archive" {
  count = local.metrics_archive_is_host ? 1 : 0

  name = local.metrics_archive_database
  tags = module.tag_config.tags
}

# Shared by the metric stream (source=stream) and the one-off backfill script (source=backfill).
resource "aws_glue_catalog_table" "email_metrics_raw" {
  count = local.metrics_archive_is_host ? 1 : 0

  name          = "email_metrics_raw"
  database_name = aws_glue_catalog_database.metrics_archive[0].name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    classification                    = "json"
    "projection.enabled"              = "true"
    "projection.source.type"          = "enum"
    "projection.source.values"        = "stream,backfill"
    "projection.source_region.type"   = "enum"
    "projection.source_region.values" = join(",", var.metrics_archive.source_regions)
    "projection.metric.type"          = "enum"
    "projection.metric.values"        = join(",", var.metrics_archive.metric_names)
    "projection.dt.type"              = "date"
    "projection.dt.format"            = "yyyy-MM-dd"
    "projection.dt.range"             = "${var.metrics_archive.partition_start_date},NOW"
    "projection.dt.interval"          = "1"
    "projection.dt.interval.unit"     = "DAYS"
    "storage.location.template"       = "s3://${local.metrics_archive_bucket_name}/metrics/source=$${source}/$${source_region}/$${metric}/dt=$${dt}/"
  }

  partition_keys {
    name = "source"
    type = "string"
  }

  # Named "source_region" because "region" is already a data column.
  partition_keys {
    name = "source_region"
    type = "string"
  }

  # Named "metric" because "metric_name" is already a data column.
  partition_keys {
    name = "metric"
    type = "string"
  }

  partition_keys {
    name = "dt"
    type = "string"
  }

  storage_descriptor {
    location      = "s3://${local.metrics_archive_bucket_name}/metrics/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    ser_de_info {
      serialization_library = "org.openx.data.jsonserde.JsonSerDe"
      parameters = {
        "ignore.malformed.json" = "true"
      }
    }

    columns {
      name = "metric_stream_name"
      type = "string"
    }
    columns {
      name = "account_id"
      type = "string"
    }
    columns {
      name = "region"
      type = "string"
    }
    columns {
      name = "namespace"
      type = "string"
    }
    columns {
      name = "metric_name"
      type = "string"
    }
    columns {
      name = "dimensions"
      type = "map<string,string>"
    }
    columns {
      name = "timestamp"
      type = "bigint"
    }
    columns {
      name = "value"
      type = "struct<min:double,max:double,count:double,sum:double>"
    }
    columns {
      name = "unit"
      type = "string"
    }
  }
}

resource "aws_athena_workgroup" "metrics_archive" {
  count = local.metrics_archive_is_host ? 1 : 0

  name = local.metrics_archive_name

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "s3://${local.metrics_archive_bucket_name}/athena-results/"

      encryption_configuration {
        encryption_option = "SSE_S3"
      }
    }
  }

  tags = module.tag_config.tags
}

resource "aws_athena_named_query" "metrics_archive" {
  for_each = local.metrics_archive_is_host ? local.metrics_archive_named_queries : {}

  name        = each.key
  description = each.value.description
  workgroup   = aws_athena_workgroup.metrics_archive[0].id
  database    = aws_glue_catalog_database.metrics_archive[0].name
  query       = each.value.query
}
