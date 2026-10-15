# One Mail - Email Retention

An event-driven AWS Lambda triggered by the `EmailStatusHistory` DynamoDB stream.

When an email reaches a final status (for example `Delivered`, `HardBounce` or `MaxRetriesReached`) it:

- sets `expiration_time` (now + `EMAIL_RETENTION_DAYS`) so the DynamoDB TTL deletes the item later;
- deletes the email attachments from S3. Low-priority attachments are shared by every email of the same request, so they are deleted only when no other email of that request is still open.

Infrastructure lives in `src/infra/src/70_domains/onemail_app/03_lambda.tf`.
