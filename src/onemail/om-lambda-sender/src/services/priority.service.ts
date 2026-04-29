import type { SQSRecord } from 'aws-lambda';

import { getNamedLogger } from '#config/logger';
import {
  SqsEventItemHigh,
  SqsEventItemHighSchema,
  SqsEventItemLow,
  SqsEventItemLowSchema,
} from '#dtos/sqsEventItem.dto';
import { DryRunValidationError } from '#errors/dryRunValidation.error';
import { PermanentEmailError } from '#errors/permanentEmail.error';
import { RetryableEmailError } from '#errors/retryableEmail.error';
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

export const handleEmailRecordByPriority = async (
  record: SQSRecord,
  isHighPriority: boolean,
): Promise<void> => {
  try {
    return await (isHighPriority
      ? handleHighPriority(record)
      : handleLowPriority(record));
  } catch (error) {
    // For permanent errors swallow the error to avoid retries
    if (error instanceof PermanentEmailError) {
      const logger = getNamedLogger(
        isHighPriority ? handleHighPriority.name : handleLowPriority.name,
      );
      logger.error(`Permanent error: ${error.message}`, {
        ...error.context,
        retryable: false,
      });
      return;
    }
    // For other errors (retryable) just re-throw to trigger the retry mechanism of the batch processor
    throw error;
  }
};

const handleHighPriority = async (record: SQSRecord): Promise<void> => {
  const logger = getNamedLogger(handleHighPriority.name);
  logger.info('Start');

  // 1. Validate the SQS record and parse the item
  const parsedRecord = await validateRecord(record, SqsEventItemHighSchema);
  const { emailId } = parsedRecord as SqsEventItemHigh;

  // 2. Fetch the email details from DB
  const email = await getEmailById(emailId);
  if (!email) {
    publishMetrics([
      {
        name: SenderMetricName.EmailNotFound,
      },
    ]);
    throw new PermanentEmailError('Email not found in DB', { emailId });
  }
  logger.debug('Email fetched from DB', { emailId });

  const clientIdDimension = { clientId: email.clientId };

  // 3. Send the email with SES
  let providerMessageId: string | undefined;
  try {
    providerMessageId = await sendHighPriorityEmail(email);
  } catch (error) {
    if (error instanceof DryRunValidationError) {
      await updateEmailStatus({ emailId, status: EmailStatus.DryRunError });
      publishMetrics([
        {
          name: SenderMetricName.HighPriorityDryRunError,
          dimensions: clientIdDimension,
        },
      ]);
      throw new PermanentEmailError('Dry-run validation failed', {
        emailId,
        error: error.message,
      });
    }

    const errorMessage = handleSesError(error);
    if (errorMessage) {
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
      throw new PermanentEmailError('Email rejected by SES', {
        emailId,
        error: errorMessage.message,
      });
    }

    throw new RetryableEmailError('SES transient failure', { emailId }, error);
  }

  // 4. Update the email status in DB
  if (!providerMessageId) {
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
    throw new PermanentEmailError('Email rejected by SES', { emailId });
  }

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

  logger.info('End');
};

const handleLowPriority = async (record: SQSRecord): Promise<void> => {
  const logger = getNamedLogger(handleLowPriority.name);
  logger.info('Start');

  // 1. Validate the SQS record and parse the item
  const parsedRecord = await validateRecord(record, SqsEventItemLowSchema);
  const { requestId } = parsedRecord as SqsEventItemLow;

  // 2. Fetch all emails for this requestId from DB
  const emails = await getEmailsByRequestId(requestId);
  if (isEmpty(emails)) {
    publishMetrics([
      {
        name: SenderMetricName.EmailBatchNotFound,
      },
    ]);
    throw new PermanentEmailError('Emails not found in DB', { requestId });
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
      throw new PermanentEmailError('Dry-run validation failed', {
        requestId,
        error: error.message,
      });
    }

    const errorMessage = handleSesError(error);
    if (errorMessage) {
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
      throw new PermanentEmailError('Email rejected by SES', {
        requestId,
        error: errorMessage.message,
      });
    }

    throw new RetryableEmailError(
      'SES transient failure',
      { requestId },
      error,
    );
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
    throw new RetryableEmailError('Retryable per-email SES failures', {
      requestId,
    });
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
): Promise<SqsEventItemHigh | SqsEventItemLow> {
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(record.body);
  } catch {
    publishMetrics([{ name: SenderMetricName.InvalidRecord }]);
    throw new PermanentEmailError('Invalid JSON payload', {
      emailRecord: record.body,
    });
  }

  const result = schema.safeParse(parsedBody);
  if (!result.success) {
    const errorMessage = result.error.issues
      .map((issue) => `${issue.path.join('.')} - ${issue.message}`)
      .join('; ');
    publishMetrics([{ name: SenderMetricName.InvalidRecord }]);
    throw new PermanentEmailError('Invalid payload', {
      error: errorMessage,
      emailRecord: record.body,
    });
  }

  return result.data;
}
