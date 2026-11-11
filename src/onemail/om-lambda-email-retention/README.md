# One Mail - Email Retention

An event-driven AWS Lambda triggered by the `EmailStatusHistory` DynamoDB stream (`MODIFY` event).

When an email reaches a final status, it deletes the email attachments from S3.
- High priority: delete the finalized email's attachments immediately.
- Low priority: attachments are shared by every email of the same request, so they are deleted only when no other email of that request is still in an open state.
