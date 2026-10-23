-- Total EmailDelivered per tenant.
SELECT tenant_name, SUM(value) AS delivered
FROM email_metrics
WHERE metric_name = 'EmailDelivered'
GROUP BY tenant_name
ORDER BY delivered DESC
