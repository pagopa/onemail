#!/usr/bin/env python3
"""Purpose: Backfill historical CloudWatch email metrics into the metrics archive bucket for Athena.

Writes hourly datapoints (CloudWatch keeps them for 455 days) as gzip JSON lines with the same shape as the
metric stream output delivered by Firehose, one object per region, metric and UTC day (rerun-safe, it overwrites):
  s3://<bucket>/metrics/source=backfill/<region>/<metric_name>/dt=YYYY-MM-DD/backfill.json.gz
Every source region is read with its own namespace and written to the archive bucket in the hosting region.
Only series listed by ListMetrics (data in the last 14 days) are backfilled.
The range is always the CloudWatch retention (455 days, ~15 months) up to the last complete hour; it starts at the
first full UTC day so a rerun never overwrites an older day with a partial one.

Usage examples:
  python backfill.py --help
  python backfill.py --bucket <bucket>
  python backfill.py --bucket <bucket> --dry-run
"""

from __future__ import annotations

import argparse
import gzip
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

import boto3

RETENTION_DAYS = 455
MAX_QUERIES_PER_CALL = 500
ARCHIVE_REGION = "eu-south-1"
# Source region -> CloudWatch namespace, aligned with metrics_archive in the onemail_monitoring tfvars.
REGION_NAMESPACES = {"eu-south-1": "oml-p-eus1", "eu-central-1": "oml-p-euc1"}
METRIC_NAMES = ["EmailDelivered", "EmailHardBounce"]
# Metric stream JSON "value" keys -> GetMetricData statistic.
STATISTICS = {"min": "Minimum", "max": "Maximum", "count": "SampleCount", "sum": "Sum"}

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def resolve_range(now: datetime) -> tuple[datetime, datetime]:
    """Return [start, end): first full UTC day still retained by CloudWatch up to the last complete hour."""
    end = now.replace(minute=0, second=0, microsecond=0)
    oldest = end - timedelta(days=RETENTION_DAYS)
    start = oldest.replace(hour=0) if oldest.hour == 0 else oldest.replace(hour=0) + timedelta(days=1)
    return start, end


def day_windows(start: datetime, end: datetime) -> Iterator[tuple[datetime, datetime]]:
    while start < end:
        next_day = (start + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        yield start, min(next_day, end)
        start = next_day


def build_queries(metrics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {"Id": f"m{index}_{key}", "MetricStat": {"Metric": metric, "Period": 3600, "Stat": stat}}
        for index, metric in enumerate(metrics)
        for key, stat in STATISTICS.items()
    ]


def to_records(
    metrics: list[dict[str, Any]],
    results: dict[str, dict[datetime, float]],
    region: str,
    account_id: str,
) -> list[dict[str, Any]]:
    """Build rows with the same shape as the CloudWatch metric stream JSON output."""
    records = []
    for index, metric in enumerate(metrics):
        points = {key: results.get(f"m{index}_{key}", {}) for key in STATISTICS}
        for timestamp in sorted(set().union(*points.values())):
            records.append({
                "metric_stream_name": "backfill",
                "account_id": account_id,
                "region": region,
                "namespace": metric["Namespace"],
                "metric_name": metric["MetricName"],
                "dimensions": {d["Name"]: d["Value"] for d in metric.get("Dimensions", [])},
                "timestamp": int(timestamp.timestamp() * 1000),
                "value": {key: points[key].get(timestamp) for key in STATISTICS},
                "unit": "Count",
            })
    return records


def to_gzip_body(records: list[dict[str, Any]]) -> bytes:
    return gzip.compress("".join(json.dumps(r, separators=(",", ":")) + "\n" for r in records).encode("utf-8"))


def group_by_object_key(records: list[dict[str, Any]], day: datetime) -> dict[str, list[dict[str, Any]]]:
    objects: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        key = f"metrics/source=backfill/{record['region']}/{record['metric_name']}/dt={day:%Y-%m-%d}/backfill.json.gz"
        objects.setdefault(key, []).append(record)
    return objects


def fetch(cloudwatch: Any, queries: list[dict[str, Any]], start: datetime, end: datetime) -> dict:
    results: dict[str, dict[datetime, float]] = {}
    paginator = cloudwatch.get_paginator("get_metric_data")
    for offset in range(0, len(queries), MAX_QUERIES_PER_CALL):
        batch = queries[offset:offset + MAX_QUERIES_PER_CALL]
        for page in paginator.paginate(MetricDataQueries=batch, StartTime=start, EndTime=end):
            for result in page["MetricDataResults"]:
                results.setdefault(result["Id"], {}).update(zip(result["Timestamps"], result["Values"]))
    return results


def list_series(cloudwatch: Any, namespace: str) -> list[dict[str, Any]]:
    paginator = cloudwatch.get_paginator("list_metrics")
    return [
        metric
        for name in METRIC_NAMES
        for page in paginator.paginate(Namespace=namespace, MetricName=name)
        for metric in page["Metrics"]
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill CloudWatch email metrics to the S3 metrics archive.")
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--dry-run", action="store_true", help="Fetch data but do not write to S3.")
    args = parser.parse_args()

    start, end = resolve_range(datetime.now(timezone.utc))
    s3 = boto3.client("s3", region_name=ARCHIVE_REGION)
    account_id = boto3.client("sts", region_name=ARCHIVE_REGION).get_caller_identity()["Account"]

    written = 0
    for region, namespace in REGION_NAMESPACES.items():
        cloudwatch = boto3.client("cloudwatch", region_name=region)
        metrics = list_series(cloudwatch, namespace)
        if not metrics:
            logger.warning("⚠️ %s: no series found in namespace %s", region, namespace)
            continue
        logger.info("📋 %s: %d series, %s -> %s", region, len(metrics), start.isoformat(), end.isoformat())

        queries = build_queries(metrics)
        for window_start, window_end in day_windows(start, end):
            records = to_records(metrics, fetch(cloudwatch, queries, window_start, window_end), region, account_id)
            for key, object_records in group_by_object_key(records, window_start).items():
                if not args.dry_run:
                    s3.put_object(Bucket=args.bucket, Key=key, Body=to_gzip_body(object_records))
                written += 1
                logger.info("%s %s: %d records", "🧪" if args.dry_run else "✅", key, len(object_records))

    if written == 0:
        logger.error("❌ No data found in any region: check namespaces and credentials")
        return 1
    logger.info("🏁 Done: %d objects", written)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
