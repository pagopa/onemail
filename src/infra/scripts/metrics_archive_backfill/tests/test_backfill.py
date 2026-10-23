import gzip
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backfill import (  # noqa: E402
    build_queries,
    day_windows,
    group_by_object_key,
    resolve_range,
    to_gzip_body,
    to_records,
)

UTC = timezone.utc
NOW = datetime(2026, 10, 22, 10, 37, tzinfo=UTC)
GLUE_TABLE_FILE = Path(__file__).resolve().parents[3] / "src/70_domains/onemail_monitoring/07_metrics_archive.tf"

# Metric stream JSON record as documented by AWS (CloudWatch-metric-streams-formats-json), default statistics only.
METRIC_STREAM_SAMPLE = {
    "metric_stream_name": "MyMetricStream",
    "account_id": "1234567890",
    "region": "us-east-1",
    "namespace": "AWS/EC2",
    "metric_name": "DiskWriteOps",
    "dimensions": {"InstanceId": "i-123456789012"},
    "timestamp": 1611929698000,
    "value": {"count": 3.0, "sum": 20.0, "max": 18.0, "min": 0.0},
    "unit": "Seconds",
}


METRIC = {
    "Namespace": "ns",
    "MetricName": "EmailHardBounce",
    "Dimensions": [{"Name": "clientId", "Value": "c1"}, {"Name": "tenantName", "Value": "t1"}],
}


def sample_record() -> dict:
    timestamp = datetime(2026, 1, 1, 1, tzinfo=UTC)
    results = {
        "m0_min": {timestamp: 1.0},
        "m0_max": {timestamp: 1.0},
        "m0_count": {timestamp: 3.0},
        "m0_sum": {timestamp: 3.0},
    }
    return to_records([METRIC], results, "eu-south-1", "123")[0]


def glue_table_definition() -> tuple[list[str], list[str]]:
    """Return the Glue column names and the field names of the value struct from Terraform."""
    content = GLUE_TABLE_FILE.read_text()
    table = content[content.index('resource "aws_glue_catalog_table" "email_metrics_raw"'):]
    descriptor = table[table.index("storage_descriptor"):]
    columns = re.findall(r'columns\s*\{\s*name\s*=\s*"([^"]+)"', descriptor)
    struct = re.search(r'name\s*=\s*"value"\s*type\s*=\s*"struct<([^>]+)>"', descriptor)
    assert struct, "value struct column not found in the Glue table"
    value_fields = [field.split(":")[0] for field in struct.group(1).split(",")]
    return columns, value_fields


def test_resolve_range_covers_retention_up_to_last_complete_hour() -> None:
    start, end = resolve_range(NOW)

    assert end == datetime(2026, 10, 22, 10, tzinfo=UTC)
    # 455 days before 2026-10-22 10:00 is 2025-07-24 10:00: start at the next full day.
    assert start == datetime(2025, 7, 25, tzinfo=UTC)


def test_resolve_range_keeps_oldest_day_when_already_at_midnight() -> None:
    start, _ = resolve_range(datetime(2026, 10, 22, 0, 15, tzinfo=UTC))

    assert start == datetime(2026, 10, 22, tzinfo=UTC) - timedelta(days=455)


def test_day_windows_split_on_utc_midnight() -> None:
    windows = list(day_windows(datetime(2026, 1, 1, 22, tzinfo=UTC), datetime(2026, 1, 3, 2, tzinfo=UTC)))

    assert windows == [
        (datetime(2026, 1, 1, 22, tzinfo=UTC), datetime(2026, 1, 2, tzinfo=UTC)),
        (datetime(2026, 1, 2, tzinfo=UTC), datetime(2026, 1, 3, tzinfo=UTC)),
        (datetime(2026, 1, 3, tzinfo=UTC), datetime(2026, 1, 3, 2, tzinfo=UTC)),
    ]


def test_build_queries_request_every_stream_statistic_hourly() -> None:
    queries = build_queries([METRIC])

    assert {q["Id"]: q["MetricStat"]["Stat"] for q in queries} == {
        "m0_min": "Minimum",
        "m0_max": "Maximum",
        "m0_count": "SampleCount",
        "m0_sum": "Sum",
    }
    assert all(q["MetricStat"]["Period"] == 3600 for q in queries)
    assert all(q["MetricStat"]["Metric"] == METRIC for q in queries)


def test_to_records_merge_statistics_into_one_row_per_timestamp() -> None:
    assert sample_record() == {
        "metric_stream_name": "backfill",
        "account_id": "123",
        "region": "eu-south-1",
        "namespace": "ns",
        "metric_name": "EmailHardBounce",
        "dimensions": {"clientId": "c1", "tenantName": "t1"},
        "timestamp": 1767229200000,
        "value": {"min": 1.0, "max": 1.0, "count": 3.0, "sum": 3.0},
        "unit": "Count",
    }


def test_records_match_metric_stream_json_format() -> None:
    record = sample_record()

    assert record.keys() == METRIC_STREAM_SAMPLE.keys()
    assert record["value"].keys() == METRIC_STREAM_SAMPLE["value"].keys()
    for key, sample_value in METRIC_STREAM_SAMPLE.items():
        assert type(record[key]) is type(sample_value), key


def test_records_match_glue_table_columns() -> None:
    columns, value_fields = glue_table_definition()
    record = sample_record()

    assert sorted(record.keys()) == sorted(columns)
    assert sorted(record["value"].keys()) == sorted(value_fields)


def test_gzip_body_is_newline_delimited_json() -> None:
    record = sample_record()

    lines = gzip.decompress(to_gzip_body([record, record])).decode("utf-8").splitlines()

    assert [json.loads(line) for line in lines] == [record, record]


def test_object_keys_follow_glue_partition_template() -> None:
    template = re.search(r'"storage\.location\.template"\s*=\s*"s3://[^/]+/([^"]+)"', GLUE_TABLE_FILE.read_text())
    assert template, "storage.location.template not found in the Glue table"
    record = sample_record()

    keys = list(group_by_object_key([record, record], datetime(2026, 1, 1, tzinfo=UTC)))

    expected_prefix = (
        template.group(1)
        .replace("$${source}", "backfill")
        .replace("$${metric}", record["metric_name"])
        .replace("$${dt}", "2026-01-01")
    )
    assert keys == [f"{expected_prefix}backfill.json.gz"]
    assert expected_prefix == "metrics/source=backfill/EmailHardBounce/dt=2026-01-01/"
