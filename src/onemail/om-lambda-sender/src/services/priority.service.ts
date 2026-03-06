import type { SQSRecord } from 'aws-lambda';

import { logger } from '#config/logger';
import {
  getEmailById,
  updateEmailStatus,
} from '#repositories/email.repository';
import { validateSqsEventItem } from '#utils/validateSqsEventItem';

import {
  //sendLowPriorityEmail,
  sendHighPriorityEmail,
} from './email.service.js';

export const handleByPriority = async (
  record: SQSRecord,
  isHighPriority: boolean,
): Promise<void> => {
  // 1. Validate the SQS record and parse the item
  const { valid, item } = validateSqsEventItem(record);
  if (!valid || !item) {
    // Log the error and skip processing this record
    // TODO: metric for invalid records
    logger.error('Invalid payload, discarding record', { record });
    return;
  }

  // 2. Fetch the email details from DB
  const email = await getEmailById(item.emailId);
  if (!email) {
    // TODO: metric for email not found
    logger.error('Email not found in DynamoDB', { emailId: item.emailId });
    return;
  }

  let sesMessageId: string | undefined;
  // 3. Send the email with SES
  if (isHighPriority) {
    // ses high
    sesMessageId = await sendHighPriorityEmail(email);
  } else {
    // ses low
    //sesMessageId = await sendLowPriorityEmail(email);
    sesMessageId = 'low-priority-placeholder'; // Placeholder until low priority is implemented
  }

  // 4. Update the email status in DB
  if (sesMessageId) {
    await updateEmailStatus(item.emailId, 'Dispatched', sesMessageId);
  } else {
    // error handling if SES failed to send the email
    // update status to RejectedBySES and log the error
    await updateEmailStatus(item.emailId, 'RejectedBySES');
    logger.error('Rejected by SES when sending email', {
      emailId: item.emailId,
    });
    return;
  }

  logger.info('Processed item', { item, email });
};
