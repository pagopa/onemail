import type { SQSRecord } from 'aws-lambda';

import { logger } from '#config/logger';
import {
  getEmailById,
  updateEmailStatus,
} from '#repositories/email.repository';
import { validateSqsEventItem } from '#utils/validateSqsEventItem';
import {
  BadRequestException,
  MailFromDomainNotVerifiedException,
  MessageRejected,
} from '@aws-sdk/client-sesv2';
import { EmailStatus } from 'om-common/types';

import {
  //sendLowPriorityEmail,
  sendHighPriorityEmail,
} from './email.service.js';

export const handleByPriority = async (
  record: SQSRecord,
  isHighPriority: boolean,
): Promise<void> => {
  logger.info('handleByPriority - start'); //todo log with some decorator
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
  try {
    if (isHighPriority) {
      // ses high
      sesMessageId = await sendHighPriorityEmail(email);
    } else {
      // ses low
      //sesMessageId = await sendLowPriorityEmail(email);
      sesMessageId = 'low-priority-placeholder'; // Placeholder until low priority is implemented
    }
  } catch (error) {
    let errorMessage;
    if (error instanceof BadRequestException) {
      //todo metrics
      errorMessage = `Rejected by SES - BadRequestException: ${error.message}`;
    } else if (error instanceof MailFromDomainNotVerifiedException) {
      //todo metrics
      errorMessage = `Rejected by SES - MailFromDomainNotVerifiedException: ${error.message}`;
    } else if (error instanceof MessageRejected) {
      //todo  metrics
      errorMessage = `Rejected by SES - MessageRejected: ${error.message}`;
    }
    if (errorMessage) {
      // Mail to not be re-sent in the queue, we update the status to RejectedBySES and log the error
      await updateEmailStatus(item.emailId, EmailStatus.RejectedBySES);
      logger.error(errorMessage);
      return;
    }
    throw error;
  }

  // 4. Update the email status in DB
  if (sesMessageId) {
    await updateEmailStatus(item.emailId, EmailStatus.Dispatched, sesMessageId);
  } else {
    // If SES returns undefined
    await updateEmailStatus(item.emailId, EmailStatus.RejectedBySES);
    logger.error('Rejected by SES when sending email', {
      emailId: item.emailId,
    });
    return;
  }

  logger.info('handleByPriority - end'); //todo log with some decorator
};
