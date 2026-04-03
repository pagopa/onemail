import type { SQSRecord } from 'aws-lambda';

import { getLogger, getNamedLogger } from '#config/logger';
import {
  ConfSetEventItemSchema,
  HandledConfSetEventItem,
} from '#dtos/confSetEventItem.dto';
import { updateEmailStatusBySesMessageId } from '#repositories/email.repository';
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
    await updateEmailStatusBySesMessageId(
      eventItem.mail.messageId,
      eventItem.delivery.timestamp,
      EmailStatus.Delivered,
    );
  }

  //Bounce
  if (eventItem.eventType === CapitalizedSesConfigurationSetEventType.Bounce) {
    // Soft Bounce
    if (
      eventItem.bounce.bounceType === CapitalizedSesBounceType.Transient ||
      eventItem.bounce.bounceType === CapitalizedSesBounceType.Undetermined
    ) {
      //todo update this logic with the one in the confluence documents
      await updateEmailStatusBySesMessageId(
        eventItem.mail.messageId,
        eventItem.bounce.timestamp,
        EmailStatus.SoftBounce,
        eventItem.bounce.bounceSubType,
      );
    }
    //Hard Bounce
    if (eventItem.bounce.bounceType === CapitalizedSesBounceType.Permanent) {
      await updateEmailStatusBySesMessageId(
        eventItem.mail.messageId,
        eventItem.bounce.timestamp,
        EmailStatus.HardBounce,
        eventItem.bounce.bounceSubType,
      );
    }
  }
  logger.info('End');
};
