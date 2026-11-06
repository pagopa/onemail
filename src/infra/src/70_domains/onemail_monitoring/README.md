monitoring
dashboard 

## Email retention alarms

When `email_retention_alarms_enabled` is enabled, the existing
`lambda_errors_email_retention` alarm uses the `lambda_errors` template with
threshold `email_retention_maximum_retry_attempts + 1`, including the initial
attempt. The default is 5 retries, hence a threshold of 6 errors.

Application and monitoring are separate Terraform stacks: keep
`email_retention_maximum_retry_attempts` aligned with
`onemail_app.lambda_email_retention.stream_maximum_retry_attempts` for each
environment. Only finite retry counts (0 through 10000) are supported.

This is an approximation, not an exhausted-retry detector: `Errors` aggregates
failed invocations across all batches in each alarm period. Separate batches can
reach the threshold even if retries later succeed, while retries spanning
different periods might never reach it. Failures reported only through
`ReportBatchItemFailures` do not increment invocation `Errors`. Record expiry is
not detected by this alarm.

The alarm's Terraform address, AWS name, and SNS actions are preserved. Throttling
alarms and other Lambda error alarms are unchanged.

Run the focused tests from this directory after initializing Terraform:

```sh
terraform test -filter=tests/email_retention.tftest.hcl -var-file=env/dev/eu-south-1/terraform.tfvars
```

These are mocked plan tests; they do not connect to AWS or create resources.
