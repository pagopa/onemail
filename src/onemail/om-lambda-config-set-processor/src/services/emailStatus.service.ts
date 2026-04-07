import type { SQSRecord } from 'aws-lambda';

import { getLogger, getNamedLogger } from '#config/logger';
import {
  ConfSetEventItemSchema,
  HandledConfSetEventItem,
} from '#dtos/confSetEventItem.dto';
import { updateEmailStatusBySesMessageId } from '#repositories/email.repository';
import { handleSoftBounceRetry } from '#services/bounceRetry.service';
import {
  CapitalizedSesBounceType,
  CapitalizedSesConfigurationSetEventType,
} from '#types/ses.type';
import isEmpty from 'lodash-es/isEmpty.js';
import { EmailStatus } from 'om-common/types';

const logger = getLogger();

const validateRecord = (
  record: SQSRecord,
  schema: typeof ConfSetEventItemSchema,
): HandledConfSetEventItem | undefined => {
  let parsedBody: unknown;
  try {
    if (isEmpty(record.body)) throw new Error('Empty body');
    parsedBody = JSON.parse(record.body);
  } catch {
    logger.error('Invalid payload, discarding record', { record });
    //Todo add metrics
    return undefined;
  }

  const result = schema.safeParse(parsedBody);
  if (!result.success) {
    //Todo add metrics
    logger.error('Invalid payload, discarding record', { record });
    return undefined;
  }
  if (
    !Object.values(CapitalizedSesConfigurationSetEventType).includes(
      result.data.eventType as CapitalizedSesConfigurationSetEventType,
    )
  ) {
    return undefined;
  }

  return result.data as HandledConfSetEventItem;
};

export const sqsEventHandler = async (record: SQSRecord): Promise<void> => {
  const logger = getNamedLogger(sqsEventHandler.name);
  logger.info('Start');
  const eventItem = validateRecord(record, ConfSetEventItemSchema);
  if (!eventItem) {
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
  } else if (
    // Bounce
    eventItem.eventType === CapitalizedSesConfigurationSetEventType.Bounce
  ) {
    // Soft Bounce
    if (
      eventItem.bounce.bounceType === CapitalizedSesBounceType.Transient ||
      eventItem.bounce.bounceType === CapitalizedSesBounceType.Undetermined
    ) {
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
    }
  } else if (
    // Complaint
    eventItem.eventType === CapitalizedSesConfigurationSetEventType.Complaint
  ) {
    await updateEmailStatusBySesMessageId(eventItem.mail.messageId, [
      {
        timestamp: eventItem.complaint.timestamp,
        status: EmailStatus.Complaint,
        reason: eventItem.complaint.complaintSubType,
      },
    ]);
  }

  logger.info('End');
};
