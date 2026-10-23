-- Creates the email_metrics view that merges backfill and metric stream data without double counting.
-- Backfill rows are kept up to one hour after the last backfilled hour; stream rows are used afterwards.
CREATE OR REPLACE VIEW email_metrics AS
WITH backfill_cutoff AS (
  SELECT COALESCE(MAX("timestamp") + 3600000, 0) AS cutoff_ms
  FROM email_metrics_raw
  WHERE source = 'backfill'
)
SELECT
  r.metric AS metric_name,
  r.dimensions['tenantName'] AS tenant_name,
  r.dimensions['clientId']   AS client_id,
  r.dimensions['service']    AS service,
  from_unixtime(r."timestamp" / 1000) AS metric_time,
  r.value.sum AS value,
  r.source,
  r.dt
FROM email_metrics_raw r
CROSS JOIN backfill_cutoff c
WHERE r.metric_name IS NOT NULL
  AND (r.source = 'backfill' OR r."timestamp" >= c.cutoff_ms)
