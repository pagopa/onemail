import type { SQSRecord } from 'aws-lambda';

import { logger } from '#config/logger';
import {
  SqsEventItemHigh,
  SqsEventItemHighSchema,
  SqsEventItemLow,
  SqsEventItemLowSchema,
} from '#dtos/sqsEventItem';
import { DryRunValidationError } from '#errors/DryRunValidationError';
import {
  batchUpdateEmailStatuses,
  getEmailById,
  getEmailsByRequestId,
  updateEmailStatus,
} from '#repositories/email.repository';
import {
  publishMetrics as publishMetrics,
  SenderMetricName,
} from '#repositories/metrics.repository';
import { RetryableBulkEmailStatuses } from '#types/retryableSESStatus';
import {
  BadRequestException,
  MailFromDomainNotVerifiedException,
  MessageRejected,
} from '@aws-sdk/client-sesv2';
import { isEmpty } from 'lodash';
import { EmailStatus } from 'om-common/types';

import {
  sendHighPriorityEmail,
  sendLowPriorityEmail,
} from './email.service.js';

export const handleHighPriority = async (record: SQSRecord): Promise<void> => {
  logger.info('handleHighPriority - start');

  // 1. Validate the SQS record and parse the item
  const parsed = validateRecord(record, SqsEventItemHighSchema);
  if (!parsed) return;

  const { emailId } = parsed as SqsEventItemHigh;

  // 2. Fetch the email details from DB
  const email = await getEmailById(emailId);
  if (!email) {
    await publishMetrics([
      {
        name: SenderMetricName.EmailNotFound,
      },
    ]);
    logger.error('Email not found in DynamoDB', { emailId });
    return;
  }

  // 3. Send the email with SES
  let sesMessageId: string | undefined;
  try {
    sesMessageId = await sendHighPriorityEmail(email);
  } catch (error) {
    if (error instanceof DryRunValidationError) {
      logger.error('Dry-run validation failed, marking email as rejected', {
        emailId,
        error: error.message,
        retryable: false,
      });
      await updateEmailStatus({ emailId, status: EmailStatus.DryRunError });
      await publishMetrics([
        { name: SenderMetricName.HighPriorityDryRunError },
      ]);
      return;
    }

    const errorMessage = handleSesError(error);
    if (errorMessage) {
      // TODO: add reason ?
      await updateEmailStatus({ emailId, status: EmailStatus.RejectedBySES });
      await publishMetrics([
        {
          name: SenderMetricName.HighPriorityRejectedBySes,
        },
      ]);
      logger.error(errorMessage);
      return;
    }
    throw error;
  }

  // 4. Update the email status in DB
  if (sesMessageId) {
    await updateEmailStatus({
      emailId,
      status: EmailStatus.Dispatched,
      messageId: sesMessageId,
    });
    await publishMetrics([
      {
        name: SenderMetricName.HighPriorityDispatched,
      },
    ]);
  } else {
    await updateEmailStatus({ emailId, status: EmailStatus.RejectedBySES });
    await publishMetrics([
      {
        name: SenderMetricName.HighPriorityRejectedBySes,
      },
    ]);
    logger.error('Rejected by SES when sending email', { emailId });
    return;
  }

  logger.info('handleHighPriority - end');
};

export const handleLowPriority = async (record: SQSRecord): Promise<void> => {
  logger.info('handleLowPriority - start');

  // 1. Validate the SQS record and parse the item
  const parsed = validateRecord(record, SqsEventItemLowSchema);
  if (!parsed) return;

  const { requestId } = parsed as SqsEventItemLow;

  // 2. Fetch all emails for this requestId from DB
  const emails = await getEmailsByRequestId(requestId);
  if (isEmpty(emails)) {
    await publishMetrics([
      {
        name: SenderMetricName.EmailBatchNotFound,
      },
    ]);
    logger.error('Emails not found in DynamoDB', { requestId });
    return;
  }

  // 3. Send bulk email with SES
  try {
    const { successful, failed } = await sendLowPriorityEmail(emails);

    const retryableFailures: typeof failed = [];
    const nonRetryableFailures: typeof failed = [];

    for (const entry of failed) {
      if (
        entry.result.Status &&
        (RetryableBulkEmailStatuses as string[]).includes(entry.result.Status)
      ) {
        retryableFailures.push(entry);
      } else {
        nonRetryableFailures.push(entry);
      }
    }

    // 4. Batch update statuses in DB
    const updates = [
      ...successful.map((entry) => ({
        item: entry.item,
        status: EmailStatus.Dispatched as EmailStatus,
        messageId: entry.result.MessageId,
      })),
      ...nonRetryableFailures.map((entry) => {
        logger.error('Bulk email entry failed', {
          emailId: entry.item.emailId,
          status: EmailStatus.RejectedBySES,
          error: entry.result.Error,
        });
        return {
          item: entry.item,
          status: EmailStatus.RejectedBySES as EmailStatus,
        };
      }),
      ...retryableFailures.map((entry) => ({
        item: entry.item,
        status: EmailStatus.Queued as EmailStatus,
      })),
    ];

    // TODO: add reason ?
    await batchUpdateEmailStatuses(updates);
    await publishMetrics([
      {
        name: SenderMetricName.LowPriorityDispatched,
        value: successful.length,
      },
      {
        name: SenderMetricName.LowPriorityRejectedBySes,
        value: nonRetryableFailures.length,
      },
      {
        name: SenderMetricName.LowPriorityRetryableFailure,
        value: retryableFailures.length,
      },
    ]);
  } catch (error) {
    if (error instanceof DryRunValidationError) {
      logger.error('Dry-run validation failed, marking batch as rejected', {
        requestId,
        error: error.message,
        retryable: false,
      });
      await batchUpdateEmailStatuses(
        emails.map((email) => ({
          item: email,
          status: EmailStatus.DryRunError as EmailStatus,
        })),
      );
      await publishMetrics([
        {
          name: SenderMetricName.LowPriorityDryRunError,
          value: emails.length,
        },
      ]);
      return;
    }
    const errorMessage = handleSesError(error);
    if (errorMessage) {
      // Whole batch rejected — mark all items
      await batchUpdateEmailStatuses(
        emails.map((email) => ({
          item: email,
          status: EmailStatus.RejectedBySES as EmailStatus,
        })),
      );
      await publishMetrics([
        {
          name: SenderMetricName.LowPriorityRejectedBySes,
          value: emails.length,
        },
      ]);
      logger.error(errorMessage);
      return;
    }
    throw error;
  }

  logger.info('handleLowPriority - end');
};

function handleSesError(error: unknown): string | undefined {
  if (error instanceof BadRequestException) {
    publishMetrics([
      {
        name: SenderMetricName.LowPriorityRejectedBySes,
      },
    ]);
    return `Rejected by SES - BadRequestException: ${error.message}`;
  }
  if (error instanceof MailFromDomainNotVerifiedException) {
    publishMetrics([
      {
        name: SenderMetricName.LowPriorityRejectedBySes,
      },
    ]);
    return `Rejected by SES - MailFromDomainNotVerifiedException: ${error.message}`;
  }
  if (error instanceof MessageRejected) {
    publishMetrics([
      {
        name: SenderMetricName.LowPriorityRejectedBySes,
      },
    ]);
    return `Rejected by SES - MessageRejected: ${error.message}`;
  }
  return undefined;
}

function validateRecord(
  record: SQSRecord,
  schema: typeof SqsEventItemHighSchema | typeof SqsEventItemLowSchema,
): SqsEventItemHigh | SqsEventItemLow | undefined {
  if (isEmpty(record.body)) {
    logger.error('Invalid payload, discarding record', { record });
    return undefined;
  }
  const result = schema.safeParse(JSON.parse(record.body));
  if (!result.success) {
    publishMetrics([
      {
        name: SenderMetricName.InvalidRecord, //TODO: check if we want this level of detail
      },
    ]);
    logger.error('Invalid payload, discarding record', { record });
    return undefined;
  }
  return result.data;
}
