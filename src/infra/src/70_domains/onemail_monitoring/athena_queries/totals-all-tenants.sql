-- Total per metric across all tenants.
SELECT metric_name, SUM(value) AS total
FROM email_metrics
GROUP BY metric_name
