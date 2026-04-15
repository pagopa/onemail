import type { SQSRecord } from 'aws-lambda';

export const makeSqsRecord = (body: unknown): SQSRecord =>
  ({
    body: JSON.stringify(body),
    eventSourceARN: 'arn:aws:sqs:eu-south-1:123456789012:queue',
  }) as SQSRecord;
