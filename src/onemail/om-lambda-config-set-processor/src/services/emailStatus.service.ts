import type { SQSRecord } from 'aws-lambda';

import { logger } from '#config/logger';
import {
  ConfSetEventItemSchema,
  HandledConfSetEventItem,
} from '#dtos/confSetEventItem.dto';
import { updateEmailStatusBySesMessageId } from '#repositories/email.repository';
import {
  CapitalizedSesBounceType,
  CapitalizedSesConfigurationSetEventType,
} from '#types/SesTypes';
import isEmpty from 'lodash-es/isEmpty.js';
import { EmailStatus } from 'om-common/types';

const validateRecord = (
  record: SQSRecord,
  schema: typeof ConfSetEventItemSchema,
): HandledConfSetEventItem | undefined => {
  if (isEmpty(record.body)) {
    //todo add metrics
    logger.error('Invalid payload, discarding record', { record });
    return undefined;
  }
  const result = schema.safeParse(JSON.parse(record.body));
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
      eventItem.mail.timestamp,
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
        eventItem.mail.timestamp,
        EmailStatus.SoftBounce,
        eventItem.bounce.bounceSubType,
      );
    }
    //Hard Bounce
    if (eventItem.bounce.bounceType === CapitalizedSesBounceType.Permanent) {
      await updateEmailStatusBySesMessageId(
        eventItem.mail.messageId,
        eventItem.mail.timestamp,
        EmailStatus.HardBounce,
        eventItem.bounce.bounceSubType,
      );
    }
  }
};
