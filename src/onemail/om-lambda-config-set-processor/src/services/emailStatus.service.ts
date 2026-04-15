import type { SQSRecord } from 'aws-lambda';

import { getLogger, getNamedLogger } from '#config/logger';
import {
  ConfSetEventItem,
  ConfSetEventItemSchema,
  EventTypeSchema,
} from '#dtos/confSetEventItem.dto';
import { updateEmailStatusBySesMessageId } from '#repositories/email.repository';
import { handleSoftBounceRetry } from '#services/bounceRetry.service';
import {
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

export const sqsEventHandler = async (record: SQSRecord): Promise<void> => {
  const logger = getNamedLogger(sqsEventHandler.name);
  logger.info('Start');
  const eventItem = validateRecord(record);
  if (!eventItem) {
    publishMetrics([
      {
        name: ConfigSetProcessorMetricName.InvalidRecord,
      },
    ]);
    return;
  }
  // Delivered
  if (
    eventItem.eventType === CapitalizedSesConfigurationSetEventType.Delivery
  ) {
    await updateEmailStatusBySesMessageId(eventItem.mail.messageId, [
      {
        timestamp: eventItem.delivery.timestamp,
        status: EmailStatus.Delivered,
      },
    ]);
    publishMetrics([
      {
        name: ConfigSetProcessorMetricName.EmailDelivered,
      },
    ]);
  } else if (
    // Bounce
    eventItem.eventType === CapitalizedSesConfigurationSetEventType.Bounce
  ) {
    // Soft Bounce
    if (
      eventItem.bounce.bounceType === CapitalizedSesBounceType.Transient ||
      eventItem.bounce.bounceType === CapitalizedSesBounceType.Undetermined
    ) {
      // Metrics published inside handleSoftBounceRetry to differentiate between different retry
      await handleSoftBounceRetry(
        eventItem.mail.messageId,
        eventItem.bounce.timestamp,
        eventItem.bounce.bounceSubType,
      );
    } else if (
      // Hard Bounce
      eventItem.bounce.bounceType === CapitalizedSesBounceType.Permanent
    ) {
      await updateEmailStatusBySesMessageId(eventItem.mail.messageId, [
        {
          timestamp: eventItem.bounce.timestamp,
          status: EmailStatus.HardBounce,
          reason: eventItem.bounce.bounceSubType,
        },
      ]);
      publishMetrics([
        {
          name: ConfigSetProcessorMetricName.EmailHardBounce,
        },
      ]);
    }
  } else if (
    // Complaint
    eventItem.eventType === CapitalizedSesConfigurationSetEventType.Complaint
  ) {
    await updateEmailStatusBySesMessageId(eventItem.mail.messageId, [
      {
        timestamp: eventItem.complaint.timestamp,
        status: EmailStatus.Complaint,
        reason: eventItem.complaint.complaintSubType ?? undefined,
      },
    ]);
    publishMetrics([
      {
        name: ConfigSetProcessorMetricName.EmailComplaint,
      },
    ]);
  }
  // TODO: implement reject handling

  logger.info('End');
};
