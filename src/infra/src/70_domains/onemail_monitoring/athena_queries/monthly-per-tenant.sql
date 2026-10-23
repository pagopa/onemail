-- Monthly totals per tenant and metric.
SELECT date_trunc('month', metric_time) AS month, tenant_name, metric_name, SUM(value) AS total
FROM email_metrics
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3
