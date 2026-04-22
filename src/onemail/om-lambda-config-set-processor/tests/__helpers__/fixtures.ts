import type { SQSRecord } from 'aws-lambda';

import {
  CapitalizedSesBounceSubType,
  CapitalizedSesBounceType,
  CapitalizedSesConfigurationSetEventType,
} from '#types/ses.type';

import { makeSqsRecordBody } from '../../../testing/fixtures.js';

export { makeEmailStatusHistoryItem } from '../../../testing/fixtures.js';

export const makeSqsRecord = (body: unknown): SQSRecord =>
  makeSqsRecordBody(body) as SQSRecord;

export const makeDeliveryEvent = (
  messageId = 'ses-msg-1',
  timestamp = '2025-01-01T00:00:00Z',
) => ({
  eventType: CapitalizedSesConfigurationSetEventType.Delivery,
  mail: { timestamp, messageId },
  delivery: { timestamp },
});

export const makeBounceEvent = (
  messageId = 'ses-msg-1',
  bounceType: CapitalizedSesBounceType = CapitalizedSesBounceType.Permanent,
  bounceSubType: CapitalizedSesBounceSubType = CapitalizedSesBounceSubType.General,
  timestamp = '2025-01-01T00:00:00Z',
) => ({
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
) => ({
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
) => ({
  eventType: CapitalizedSesConfigurationSetEventType.Reject,
  mail: { timestamp: '2025-01-01T00:00:00Z', messageId },
  reject: { reason },
});

export const makeRenderingFailureEvent = (
  messageId = 'ses-msg-1',
  templateName = 'my-template',
  errorMessage: string | null = 'missing variable',
) => ({
  eventType: CapitalizedSesConfigurationSetEventType.RenderingFailure,
  mail: { timestamp: '2025-01-01T00:00:00Z', messageId },
  failure: { templateName, errorMessage },
});
