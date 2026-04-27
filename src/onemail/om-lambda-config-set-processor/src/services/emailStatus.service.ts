import type { SQSRecord } from 'aws-lambda';
import type { EmailStatusHistoryItem } from 'om-common/types';

import { getLogger, getNamedLogger } from '#config/logger';
import {
  ConfSetEventItem,
  ConfSetEventItemSchema,
  EventTypeSchema,
} from '#dtos/confSetEventItem.dto';
import {
  findEmailByProviderMessageId,
  updateEmailStatus,
} from '#repositories/email.repository';
import { handleSoftBounceRetry } from '#services/bounceRetry.service';
import {
  CapitalizedSesBounceSubType,
  CapitalizedSesBounceType,
  CapitalizedSesConfigurationSetEventType,
} from '#types/ses.type';
import isEmpty from 'lodash-es/isEmpty.js';
import {
  ConfigSetProcessorMetricName,
  publishMetrics,
} from 'om-common/repositories';
import { EmailStatus } from 'om-common/types';

const logger = getLogger();

/** Transient sub-types that are non-retryable and treated as hard bounces */
const NON_RETRYABLE_TRANSIENT_SUB_TYPES = new Set<
  CapitalizedSesBounceSubType | undefined | null
>([
  CapitalizedSesBounceSubType.AttachmentRejected,
  CapitalizedSesBounceSubType.ContentRejected,
  CapitalizedSesBounceSubType.MessageTooLarge,
]);

const extractEventPayload = (recordBody: string): Record<string, unknown> => {
  const parsedRecordBody = JSON.parse(recordBody);
  return Object.hasOwn(parsedRecordBody, 'detail')
    ? parsedRecordBody.detail
    : parsedRecordBody;
};

const validateRecord = (record: SQSRecord): ConfSetEventItem | undefined => {
  let parsedBody: Record<string, unknown>;
  try {
    if (isEmpty(record.body)) throw new Error('Empty body');
    parsedBody = extractEventPayload(record.body);
  } catch {
    logger.error('Invalid payload, discarding record', { record });
    return undefined;
  }

  // Stage 1: extract eventType only
  const eventTypeResult = EventTypeSchema.safeParse(parsedBody);
  if (!eventTypeResult.success) {
    logger.error('Invalid payload, discarding record', { record });
    return undefined;
  }

  const { eventType } = eventTypeResult.data;

  // Stage 2: if eventType is known, parse with the full schema — failure is an error
  const isKnownEventType = Object.values(
    CapitalizedSesConfigurationSetEventType,
  ).includes(eventType as CapitalizedSesConfigurationSetEventType);

  if (!isKnownEventType) {
    return undefined;
  }

  const result = ConfSetEventItemSchema.safeParse(parsedBody);
  if (!result.success) {
    logger.error('Invalid payload for known event type, discarding record', {
      record,
      eventType,
      errors: result.error.issues,
    });
    return undefined;
  }

  return result.data;
};

const isHardBounce = (
  event: Extract<ConfSetEventItem, { eventType: 'Bounce' }>,
): EmailStatus => {
  const { bounceType, bounceSubType } = event.bounce;
  if (bounceType === CapitalizedSesBounceType.Permanent)
    return EmailStatus.HardBounce;
  if (
    bounceType === CapitalizedSesBounceType.Transient &&
    NON_RETRYABLE_TRANSIENT_SUB_TYPES.has(bounceSubType)
  )
    return EmailStatus.NonRetryableSoftBounce;
  return EmailStatus.SoftBounce;
};

const handleBounce = async (
  event: Extract<ConfSetEventItem, { eventType: 'Bounce' }>,
  emailRecord: EmailStatusHistoryItem,
): Promise<void> => {
  const bounceStatus = isHardBounce(event);
  if (bounceStatus === EmailStatus.HardBounce) {
    await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
      {
        timestamp: event.bounce.timestamp,
        status: EmailStatus.HardBounce,
        reason: event.bounce.bounceSubType,
      },
    ]);
    publishMetrics([{ name: ConfigSetProcessorMetricName.EmailHardBounce }]);
  } else if (bounceStatus === EmailStatus.NonRetryableSoftBounce) {
    await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
      {
        timestamp: event.bounce.timestamp,
        status: EmailStatus.NonRetryableSoftBounce,
        reason: event.bounce.bounceSubType,
      },
    ]);
    publishMetrics([
      { name: ConfigSetProcessorMetricName.EmailNonRetryableSoftBounce },
    ]);
  } else {
    // Soft bounce (Undetermined or retryable Transient)
    // Metrics published inside handleSoftBounceRetry to differentiate between different retry
    await handleSoftBounceRetry(
      emailRecord,
      event.bounce.timestamp,
      event.bounce.bounceSubType,
    );
  }
};

export const sqsEventHandler = async (record: SQSRecord): Promise<void> => {
  const logger = getNamedLogger(sqsEventHandler.name);
  logger.info('Start');
  const eventItem = validateRecord(record);
  if (!eventItem) {
    publishMetrics([{ name: ConfigSetProcessorMetricName.InvalidRecord }]);
    return;
  }
  const emailRecord = await findEmailByProviderMessageId(
    eventItem.mail.messageId,
  );
  if (!emailRecord) {
    logger.error('Email record not found for provider message ID', {
      providerMessageId: eventItem.mail.messageId,
    });
    publishMetrics([{ name: ConfigSetProcessorMetricName.EmailNotFound }]);
    return;
  }
  if (EmailStatus.Queued === emailRecord.status) {
    logger.error(
      'Email already queued for retry, skipping additional retry scheduling',
      { emailId: emailRecord.emailId },
    );
    publishMetrics([{ name: ConfigSetProcessorMetricName.EmailAlreadyQueued }]);
    return;
  }

  switch (eventItem.eventType) {
    case CapitalizedSesConfigurationSetEventType.Bounce:
      await handleBounce(eventItem, emailRecord);
      break;

    case CapitalizedSesConfigurationSetEventType.Complaint:
      await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
        {
          timestamp: eventItem.complaint.timestamp,
          status: EmailStatus.Complaint,
          reason: eventItem.complaint.complaintSubType ?? undefined,
        },
      ]);
      publishMetrics([{ name: ConfigSetProcessorMetricName.EmailComplaint }]);
      break;

    case CapitalizedSesConfigurationSetEventType.Delivery:
      await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
        {
          timestamp: eventItem.delivery.timestamp,
          status: EmailStatus.Delivered,
        },
      ]);
      publishMetrics([{ name: ConfigSetProcessorMetricName.EmailDelivered }]);
      break;

    case CapitalizedSesConfigurationSetEventType.Reject:
      await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
        {
          timestamp: new Date().toISOString(),
          status: EmailStatus.Rejected,
          reason: eventItem.reject.reason ?? 'Bad content',
        },
      ]);
      publishMetrics([{ name: ConfigSetProcessorMetricName.EmailRejected }]);
      break;

    case CapitalizedSesConfigurationSetEventType.RenderingFailure:
      await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
        {
          timestamp: new Date().toISOString(),
          status: EmailStatus.Rejected,
          reason: eventItem.failure.errorMessage
            ? `Template rendering failure "${eventItem.failure.templateName}": ${eventItem.failure.errorMessage}`
            : `Template rendering failure "${eventItem.failure.templateName}"`,
        },
      ]);
      publishMetrics([
        { name: ConfigSetProcessorMetricName.EmailRenderingFailure },
      ]);
      break;
  }

  logger.info('End');
};
