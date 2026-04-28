import type { SQSRecord } from 'aws-lambda';

import { getLogger, getNamedLogger } from '#config/logger';
import {
  SqsEventItemHigh,
  SqsEventItemHighSchema,
  SqsEventItemLow,
  SqsEventItemLowSchema,
} from '#dtos/sqsEventItem.dto';
import { DryRunValidationError } from '#errors/dryRunValidation.error';
import {
  batchUpdateEmailStatuses,
  getEmailById,
  getEmailsByRequestId,
  updateEmailStatus,
} from '#repositories/email.repository';
import { RetryableBulkEmailStatuses } from '#types/retryableSESStatus.type';
import {
  BadRequestException,
  MailFromDomainNotVerifiedException,
  MessageRejected,
  SESv2ServiceException,
} from '@aws-sdk/client-sesv2';
import isEmpty from 'lodash-es/isEmpty.js';
import { publishMetrics, SenderMetricName } from 'om-common/repositories';
import { EmailStatus } from 'om-common/types';

import {
  sendHighPriorityEmail,
  sendLowPriorityEmail,
} from './email.service.js';

const logger = getLogger();

export const handleHighPriority = async (record: SQSRecord): Promise<void> => {
  const logger = getNamedLogger(handleHighPriority.name);
  logger.info('Start');

  // 1. Validate the SQS record and parse the item
  const parsed = await validateRecord(record, SqsEventItemHighSchema);
  if (!parsed) return;

  const { emailId } = parsed as SqsEventItemHigh;

  // 2. Fetch the email details from DB
  const email = await getEmailById(emailId);
  if (!email) {
    logger.error('Email not found in DB', {
      emailId,
      retryable: false,
    });
    publishMetrics([
      {
        name: SenderMetricName.EmailNotFound,
      },
    ]);
    return;
  }
  logger.debug('Email fetched from DB', { emailId });

  const clientIdDimension = { clientId: email.clientId };

  // 3. Send the email with SES
  let providerMessageId: string | undefined;
  try {
    providerMessageId = await sendHighPriorityEmail(email);
  } catch (error) {
    if (error instanceof DryRunValidationError) {
      logger.error('Dry-run validation failed', {
        error: error.message,
        retryable: false,
      });
      await updateEmailStatus({ emailId, status: EmailStatus.DryRunError });
      publishMetrics([
        {
          name: SenderMetricName.HighPriorityDryRunError,
          dimensions: clientIdDimension,
        },
      ]);
      return;
    }

    const errorMessage = handleSesError(error);
    if (errorMessage) {
      logger.error(`Rejected by SES`, {
        emailId,
        error: errorMessage.message,
        retryable: false,
      });
      await updateEmailStatus({
        emailId,
        status: EmailStatus.Rejected,
        reason: errorMessage.reason,
      });
      publishMetrics([
        {
          name: SenderMetricName.HighPriorityRejected,
          dimensions: clientIdDimension,
        },
      ]);
      return;
    }

    logger.error(`SES error`, {
      emailId,
      error,
      retryable: true,
    });
    throw error;
  }

  // 4. Update the email status in DB
  if (providerMessageId) {
    logger.debug('Email accepted by SES', {
      emailId,
      providerMessageId,
    });
    await updateEmailStatus({
      emailId,
      status: EmailStatus.Dispatched,
      providerMessageId: providerMessageId,
    });
    publishMetrics([
      {
        name: SenderMetricName.HighPriorityDispatched,
        dimensions: clientIdDimension,
      },
    ]);
  } else {
    logger.error('Email rejected by SES', {
      emailId,
      retryable: false,
    });
    await updateEmailStatus({
      emailId,
      status: EmailStatus.Rejected,
      reason: 'Unknown SES error',
    });
    publishMetrics([
      {
        name: SenderMetricName.HighPriorityRejected,
        dimensions: clientIdDimension,
      },
    ]);
    return;
  }

  logger.info('End');
};

export const handleLowPriority = async (record: SQSRecord): Promise<void> => {
  const logger = getNamedLogger(handleLowPriority.name);
  logger.info('Start');

  // 1. Validate the SQS record and parse the item
  const parsed = await validateRecord(record, SqsEventItemLowSchema);
  if (!parsed) return;

  const { requestId } = parsed as SqsEventItemLow;

  // 2. Fetch all emails for this requestId from DB
  const emails = await getEmailsByRequestId(requestId);
  if (isEmpty(emails)) {
    logger.error('Emails not found in DB', {
      requestId,
      retryable: false,
    });
    publishMetrics([
      {
        name: SenderMetricName.EmailBatchNotFound,
      },
    ]);
    return;
  }
  logger.debug('Emails fetched from DB', {
    requestId,
    count: emails.length,
  });

  // 3. Send bulk email with SES
  let updates = [];
  let successfulEmails = [];
  const retryableFailures = [];
  const nonRetryableFailures = [];
  try {
    const { successful, failed } = await sendLowPriorityEmail(emails);
    logger.debug('Emails accepted by SES', {
      requestId,
      successful: successful.length,
      failed: failed.length,
    });

    successfulEmails = successful;

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
    updates = [
      ...successfulEmails.map((entry) => ({
        item: entry.item,
        status: EmailStatus.Dispatched,
        providerMessageId: entry.result.MessageId,
      })),
      ...nonRetryableFailures.map((entry) => {
        logger.error('Email rejected by SES', {
          emailId: entry.item.emailId,
          error: entry.result.Error,
          retryable: false,
        });
        return {
          item: entry.item,
          status: EmailStatus.Rejected,
          reason: entry.result.Error,
        };
      }),
      // TODO: align behavior between high and low priority - for high priority we do not update the status in case of retryable errors
      ...retryableFailures.map((entry) => {
        logger.error('Email rejected by SES', {
          emailId: entry.item.emailId,
          error: entry.result.Error,
          retryable: true,
        });
        return {
          item: entry.item,
          status: EmailStatus.Queued,
        };
      }),
    ];
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
          status: EmailStatus.DryRunError,
        })),
      );
      publishMetrics([
        {
          name: SenderMetricName.LowPriorityDryRunError,
          value: emails.length,
        },
      ]);
      return;
    }

    const errorMessage = handleSesError(error);
    if (errorMessage) {
      logger.error(`Rejected by SES`, {
        requestId,
        error: errorMessage.message,
        retryable: false,
      });
      // Whole batch rejected — mark all items
      await batchUpdateEmailStatuses(
        emails.map((email) => ({
          item: email,
          status: EmailStatus.Rejected,
          reason: errorMessage.reason,
        })),
      );
      publishMetrics([
        {
          name: SenderMetricName.LowPriorityRejected,
          value: emails.length,
        },
      ]);
      return;
    }
    logger.error(`SES error`, {
      requestId,
      error,
      retryable: true,
    });
    // TODO: update entries in dynamo (?)
    throw error;
  }

  await batchUpdateEmailStatuses(updates);

  const metrics = [
    {
      name: SenderMetricName.LowPriorityDispatched,
      value: successfulEmails.length,
    },
    {
      name: SenderMetricName.LowPriorityRejected,
      value: nonRetryableFailures.length,
    },
    {
      name: SenderMetricName.LowPriorityRetryableFailure,
      value: retryableFailures.length,
    },
  ].filter((m) => m.value > 0);

  if (metrics.length > 0) {
    publishMetrics(metrics);
  }

  if (retryableFailures.length > 0) {
    throw new Error('Retryable failures occurred');
  }

  logger.info('End');
};

function handleSesError(
  error: unknown,
): { message: string; reason: string } | undefined {
  if (error instanceof BadRequestException) {
    return {
      message: `BadRequestException: ${error.message}`,
      reason: 'BadRequestException',
    };
  }
  if (error instanceof MailFromDomainNotVerifiedException) {
    return {
      message: `MailFromDomainNotVerifiedException: ${error.message}`,
      reason: 'MailFromDomainNotVerifiedException',
    };
  }
  if (error instanceof MessageRejected) {
    return {
      message: `MessageRejected: ${error.message}`,
      reason: 'MessageRejected',
    };
  }
  // TODO: handle SES exceptions related to tenant configuration in ecs-dispatcher,
  // before reaching lambda sender
  if (
    error instanceof SESv2ServiceException &&
    error.name === 'AccessDeniedException'
  ) {
    return {
      message: `AccessDeniedException: ${error.message}`,
      reason:
        'AccessDeniedException: not authorized to perform the requested SES action',
    };
  }
  if (
    error instanceof SESv2ServiceException &&
    error.name === 'NotFoundException'
  ) {
    return {
      message: `NotFoundException: ${error.message}`,
      reason: 'NotFoundException: the template used might not exist in SES',
    };
  }
  return undefined;
}

async function validateRecord(
  record: SQSRecord,
  schema: typeof SqsEventItemHighSchema | typeof SqsEventItemLowSchema,
): Promise<SqsEventItemHigh | SqsEventItemLow | undefined> {
  let parsedBody: unknown;
  try {
    if (isEmpty(record.body)) throw new Error('Empty body');
    parsedBody = JSON.parse(record.body);
  } catch {
    logger.error('Invalid payload, discarding record', { record });
    publishMetrics([
      {
        name: SenderMetricName.InvalidRecord,
      },
    ]);
    return undefined;
  }

  const result = schema.safeParse(parsedBody);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      message: `${issue.path.join('.')} - ${issue.message}`,
    }));
    logger.error('Invalid payload, discarding record', { record, errors });
    publishMetrics([
      {
        name: SenderMetricName.InvalidRecord,
      },
    ]);
    return undefined;
  }
  return result.data;
}
