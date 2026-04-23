import type { SQSRecord } from 'aws-lambda';

import { ConfSetEventItem } from '#dtos/confSetEventItem.dto';
import {
  CapitalizedSesBounceSubType,
  CapitalizedSesBounceType,
  CapitalizedSesConfigurationSetEventType,
} from '#types/ses.type';
import {
  EmailPriority,
  EmailStatus,
  type EmailStatusHistoryItem,
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

export const makeQueueRecord = (body: Partial<ConfSetEventItem>): SQSRecord =>
  ({
    body: JSON.stringify(body),
    eventSourceARN: 'arn:aws:sqs:eu-south-1:123456789012:queue',
  }) as SQSRecord;

export const makeDeliveryEvent = (
  messageId = 'ses-msg-1',
  timestamp = '2025-01-01T00:00:00Z',
): ConfSetEventItem => ({
  eventType: CapitalizedSesConfigurationSetEventType.Delivery,
  mail: { timestamp, messageId },
  delivery: { timestamp },
});

export const makeBounceEvent = (
  messageId = 'ses-msg-1',
  bounceType: CapitalizedSesBounceType = CapitalizedSesBounceType.Permanent,
  bounceSubType: CapitalizedSesBounceSubType = CapitalizedSesBounceSubType.General,
  timestamp = '2025-01-01T00:00:00Z',
): ConfSetEventItem => ({
  eventType: CapitalizedSesConfigurationSetEventType.Bounce,
  mail: { timestamp, messageId },
  bounce: {
    bounceType,
    bounceSubType,
    feedbackId: 'feedback-1',
    bouncedRecipients: [{ emailAddress: 'user@example.com' }],
    timestamp,
  },
});

export const makeComplaintEvent = (
  messageId = 'ses-msg-1',
  timestamp = '2025-01-01T00:00:00Z',
  complaintSubType: string | null = null,
): ConfSetEventItem => ({
  eventType: CapitalizedSesConfigurationSetEventType.Complaint,
  mail: { timestamp, messageId },
  complaint: {
    complainedRecipients: [{ emailAddress: 'user@example.com' }],
    timestamp,
    feedbackId: 'feedback-1',
    complaintSubType,
  },
});

export const makeRejectEvent = (
  messageId = 'ses-msg-1',
  reason: string | null = 'Bad content',
): ConfSetEventItem => ({
  eventType: CapitalizedSesConfigurationSetEventType.Reject,
  mail: { timestamp: '2025-01-01T00:00:00Z', messageId },
  reject: { reason },
});

export const makeRenderingFailureEvent = (
  messageId = 'ses-msg-1',
  templateName = 'my-template',
  errorMessage: string | null = 'missing variable',
): ConfSetEventItem => ({
  eventType: CapitalizedSesConfigurationSetEventType.RenderingFailure,
  mail: { timestamp: '2025-01-01T00:00:00Z', messageId },
  failure: { templateName, errorMessage },
});
