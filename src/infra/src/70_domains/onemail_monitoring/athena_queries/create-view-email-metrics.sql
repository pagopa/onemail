-- Creates the email_metrics view that merges backfill and metric stream data of every region without double counting.
-- Per region, backfill rows are kept up to one hour after the last backfilled hour; stream rows are used afterwards.
CREATE OR REPLACE VIEW email_metrics AS
WITH backfill_cutoff AS (
  SELECT source_region, MAX("timestamp") + 3600000 AS cutoff_ms
  FROM email_metrics_raw
  WHERE source = 'backfill'
  GROUP BY source_region
)
SELECT
  r.source_region AS region,
  r.metric AS metric_name,
  COALESCE(r.dimensions['tenantName'], r.dimensions['tenantname']) AS tenant_name,
  COALESCE(r.dimensions['clientId'], r.dimensions['clientid'])     AS client_id,
  r.dimensions['service']    AS service,
  from_unixtime(r."timestamp" / 1000) AS metric_time,
  r.value.sum AS value,
  r.source,
  r.dt
FROM email_metrics_raw r
LEFT JOIN backfill_cutoff c ON r.source_region = c.source_region
WHERE r.metric_name IS NOT NULL
  AND (r.source = 'backfill' OR r."timestamp" >= COALESCE(c.cutoff_ms, 0))
