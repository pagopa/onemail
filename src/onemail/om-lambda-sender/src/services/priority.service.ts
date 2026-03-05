import type { SQSRecord } from 'aws-lambda';

import { logger } from '#config/logger';
import { getEmailById } from '#repositories/email.repository';
import { validateSqsEventItem } from '#utils/validateSqsEventItem';

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

  // 3. Send the email with SES
  if (isHighPriority) {
    // ses high
  } else {
    // ses low
  }

  // 4. Update the email status in DB

  logger.info('Processed item', { item, email });
};
