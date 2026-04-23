import type { SQSRecord } from 'aws-lambda';

import { SqsEventItemHigh, SqsEventItemLow } from '#dtos/sqsEventItem.dto';
import {
  EmailPriority,
  EmailStatus,
  EmailStatusHistoryItem,
} from 'om-common/types';

export const makeEmailStatusHistoryItem = (
  overrides: Partial<EmailStatusHistoryItem> = {},
): EmailStatusHistoryItem => ({
  emailId: 'email-1',
  requestId: 'request-1',
  priority: EmailPriority.HIGH,
  status: EmailStatus.Queued,
  history: [],
  content: {
    from: {
      email: 'sender@example.com',
      name: 'Sender Name',
    },
    to: {
      email: 'user@example.com',
      name: 'User Name',
    },
    subject: 'Hello',
    body: {
      html: '<p>Hello</p>',
      text: 'Hello',
    },
  },
  clientId: 'client-1',
  dryRun: false,
  configSetName: 'config-set-1',
  tenantName: 'tenant-1',
  ...overrides,
});

export const makeQueueRecord = (
  body: Partial<SqsEventItemHigh> | Partial<SqsEventItemLow>,
): SQSRecord =>
  ({
    body: JSON.stringify(body),
    eventSourceARN: 'arn:aws:sqs:eu-south-1:123456789012:queue',
  }) as SQSRecord;
