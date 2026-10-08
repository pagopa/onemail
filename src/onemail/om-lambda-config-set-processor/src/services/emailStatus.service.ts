import type { SQSRecord } from 'aws-lambda';
import type { EmailStatusHistoryItem } from 'om-common/types';

import { getLogger, getNamedLogger } from '#config/logger';
import {
  ConfSetBounceEventItem,
  ConfSetEventItem,
  ConfSetEventItemSchema,
  EventTypeSchema,
} from '#dtos/confSetEventItem.dto';
import { addToBlacklist } from '#repositories/blacklist.repository';
import {
  findEmailByProviderMessageId,
  updateEmailStatus,
} from '#repositories/email.repository';
import { handleSoftBounceRetry } from '#services/bounceRetry.service';
import {
  CapitalizedNonRetryableTransientSubTypes,
  CapitalizedSesBounceType,
  CapitalizedSesConfigurationSetEventType,
} from '#types/ses.type';
import {
  EMAIL_NOT_FOUND_MAX_ATTEMPTS,
  INTERNAL_MAX_ATTEMPTS,
} from '#utils/constants';
import { PermanentEventError, RetryableEventError } from 'om-common/errors';
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

const throwInvalidRecord = (
  message: string,
  options?: {
    record?: unknown;
    error?: string;
    publishMetrics?: boolean;
    silent?: boolean;
  },
): never => {
  if (options?.publishMetrics !== false) {
    publishMetrics([{ name: ConfigSetProcessorMetricName.InvalidRecord }]);
  }
  throw new PermanentEventError(message, {
    record: options?.record,
    error: options?.error,
    silent: options?.silent,
  });
};

const validateRecord = (record: SQSRecord): ConfSetEventItem => {
  let parsedBody: Record<string, unknown>;
  try {
    parsedBody = extractEventPayload(record.body);
  } catch {
    throw throwInvalidRecord('Invalid record payload', { record: record.body });
  }

  // Stage 1: extract eventType only
  const eventTypeResult = EventTypeSchema.safeParse(parsedBody);
  if (!eventTypeResult.success) {
    const error = eventTypeResult.error.issues
      .map((issue) => `${issue.path.join('.')} - ${issue.message}`)
      .join('; ');
    throw throwInvalidRecord('Invalid record payload', {
      record: record.body,
      error,
    });
  }

  const { eventType } = eventTypeResult.data;

  // Stage 2: if eventType is known, parse with the full schema — failure is an error
  const isKnownEventType = Object.values(
    CapitalizedSesConfigurationSetEventType,
  ).includes(eventType as CapitalizedSesConfigurationSetEventType);

  if (!isKnownEventType) {
    // silent: true — unknown event types are expected noise, suppress logger.error
    throw throwInvalidRecord('Unknown event type', {
      publishMetrics: false,
      silent: true,
    });
  }

  const result = ConfSetEventItemSchema.safeParse(parsedBody);
  if (!result.success) {
    const error = result.error.issues
      .map((issue) => `${issue.path.join('.')} - ${issue.message}`)
      .join('; ');
    throw throwInvalidRecord('Invalid record payload for known event type', {
      record: record.body,
      error,
    });
  }

  return result.data;
};

const getBounceStatus = (
  event: Extract<ConfSetEventItem, { eventType: 'Bounce' }>,
): EmailStatus => {
  const { bounceType, bounceSubType } = event.bounce;
  if (bounceType === CapitalizedSesBounceType.Permanent) {
    return EmailStatus.HardBounce;
  }

  const hasNonRetryableDiagnostic = event.bounce.bouncedRecipients.some(
    ({ diagnosticCode }) =>
      typeof diagnosticCode === 'string' &&
      (/remote mta does not support starttls/i.test(diagnosticCode) ||
        /hop count exceeded.*possible mail loop/i.test(diagnosticCode)),
  );

  if (
    bounceType === CapitalizedSesBounceType.Transient &&
    (hasNonRetryableDiagnostic ||
      (bounceSubType &&
        CapitalizedNonRetryableTransientSubTypes.has(bounceSubType)))
  )
    return EmailStatus.NonRetryableSoftBounce;
  return EmailStatus.SoftBounce;
};

const addHardBouncedRecipientsToBlacklist = async (
  event: ConfSetBounceEventItem,
  emailRecord: EmailStatusHistoryItem,
): Promise<void> => {
  // Failures are swallowed: retrying the record would append duplicate status history entries
  await Promise.all(
    event.bounce.bouncedRecipients.map(({ emailAddress }) =>
      addToBlacklist({
        emailAddress,
        tenantName: emailRecord.tenantName,
      }).catch((error: unknown) => {
        logger.error('Failed to add hard bounced address to the blacklist', {
          emailId: emailRecord.emailId,
          error,
        });
      }),
    ),
  );
};

const handleBounce = async (
  event: ConfSetBounceEventItem,
  emailRecord: EmailStatusHistoryItem,
): Promise<void> => {
  const bounceStatus = getBounceStatus(event);
  if (bounceStatus === EmailStatus.HardBounce) {
    await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
      {
        timestamp: event.bounce.timestamp,
        status: EmailStatus.HardBounce,
        reason: event.bounce.bounceSubType,
      },
    ]);
    await addHardBouncedRecipientsToBlacklist(event, emailRecord);
    publishMetrics([
      {
        name: ConfigSetProcessorMetricName.EmailHardBounce,
        dimensions: {
          tenantName: emailRecord.tenantName,
          clientId: emailRecord.clientId,
        },
      },
    ]);
  } else if (bounceStatus === EmailStatus.NonRetryableSoftBounce) {
    await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
      {
        timestamp: event.bounce.timestamp,
        status: EmailStatus.NonRetryableSoftBounce,
        reason: event.bounce.bounceSubType,
      },
    ]);
    publishMetrics([
      {
        name: ConfigSetProcessorMetricName.EmailNonRetryableSoftBounce,
        dimensions: {
          tenantName: emailRecord.tenantName,
          clientId: emailRecord.clientId,
        },
      },
    ]);
  } else {
    // Soft bounce (Undetermined or retryable Transient)
    // Metrics published inside handleSoftBounceRetry to differentiate between different retry types
    await handleSoftBounceRetry(
      emailRecord,
      event.bounce.timestamp,
      event.bounce.bounceSubType,
    );
  }
};

const handleMissingEmailRecord = (
  providerMessageId: string,
  currentAttempt: number,
): never => {
  if (currentAttempt > EMAIL_NOT_FOUND_MAX_ATTEMPTS) {
    publishMetrics([
      { name: ConfigSetProcessorMetricName.ExhaustedInternalRetries },
    ]);
    throw new PermanentEventError(
      'Email record not found after max internal retries',
      { providerMessageId },
    );
  }

  // SES events may arrive before the sender's write is visible in the eventually consistent DynamoDB GSI.
  throw new RetryableEventError('Email record not found', {
    providerMessageId,
    attempt: currentAttempt,
  });
};

async function checkIfMaxInternalAttemptsReached(
  currentAttempt: number,
  email: EmailStatusHistoryItem,
  event: ConfSetEventItem,
): Promise<void> {
  if (currentAttempt <= INTERNAL_MAX_ATTEMPTS) return;

  const identifier = email.emailId;

  // If event status is delivery, mark as delivered; but log and publish error metrics
  // otherwise, mark as failed with EventProcessingFailed status
  if (event.eventType === CapitalizedSesConfigurationSetEventType.Delivery) {
    await updateEmailStatus(identifier, email.status, [
      { timestamp: event.delivery.timestamp, status: EmailStatus.Delivered },
    ]);
  } else {
    await updateEmailStatus(identifier, email.status, [
      {
        timestamp: new Date().toISOString(),
        status: EmailStatus.EventProcessingFailed,
        reason: 'Max internal event processing retries exceeded',
      },
    ]);
  }

  publishMetrics([
    {
      name: ConfigSetProcessorMetricName.ExhaustedInternalRetries,
      dimensions: { tenantName: email.tenantName, clientId: email.clientId },
    },
  ]);
  throw new PermanentEventError('Record exceeded max internal retries', {
    emailId: identifier,
  });
}

export const sqsEventHandler = async (record: SQSRecord): Promise<void> => {
  const logger = getNamedLogger(sqsEventHandler.name);
  logger.info('Start');

  const currentAttempt = Number(
    record.attributes?.ApproximateReceiveCount ?? 1,
  );

  try {
    const eventItem = validateRecord(record);

    const emailRecord = await findEmailByProviderMessageId(
      eventItem.mail.messageId,
    );
    if (!emailRecord) {
      return handleMissingEmailRecord(eventItem.mail.messageId, currentAttempt);
    }

    await checkIfMaxInternalAttemptsReached(
      currentAttempt,
      emailRecord,
      eventItem,
    );

    // Skip if current status is already Queued to avoid duplicate retries
    if (EmailStatus.Queued === emailRecord.status) {
      publishMetrics([
        { name: ConfigSetProcessorMetricName.EmailAlreadyQueued },
      ]);
      throw new PermanentEventError(
        'Email already queued for retry, skipping additional retry scheduling',
        {
          emailId: emailRecord.emailId,
        },
      );
    }

    switch (eventItem.eventType) {
      case CapitalizedSesConfigurationSetEventType.Bounce:
        await handleBounce(eventItem, emailRecord);
        break;

      case CapitalizedSesConfigurationSetEventType.Complaint:
        await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
          {
            timestamp: eventItem.complaint.timestamp,
            status: EmailStatus.Complaint,
            reason: eventItem.complaint.complaintSubType ?? undefined,
          },
        ]);
        publishMetrics([
          {
            name: ConfigSetProcessorMetricName.EmailComplaint,
            dimensions: {
              tenantName: emailRecord.tenantName,
              clientId: emailRecord.clientId,
            },
          },
        ]);
        break;

      case CapitalizedSesConfigurationSetEventType.Delivery:
        await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
          {
            timestamp: eventItem.delivery.timestamp,
            status: EmailStatus.Delivered,
          },
        ]);
        publishMetrics([
          {
            name: ConfigSetProcessorMetricName.EmailDelivered,
            dimensions: {
              tenantName: emailRecord.tenantName,
              clientId: emailRecord.clientId,
            },
          },
        ]);
        break;

      case CapitalizedSesConfigurationSetEventType.Reject:
        await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
          {
            timestamp: new Date().toISOString(),
            status: EmailStatus.Rejected,
            reason: eventItem.reject.reason ?? 'Bad content',
          },
        ]);
        publishMetrics([
          {
            name: ConfigSetProcessorMetricName.EmailRejected,
            dimensions: {
              tenantName: emailRecord.tenantName,
              clientId: emailRecord.clientId,
            },
          },
        ]);
        break;

      case CapitalizedSesConfigurationSetEventType.RenderingFailure:
        await updateEmailStatus(emailRecord.emailId, emailRecord.status, [
          {
            timestamp: new Date().toISOString(),
            status: EmailStatus.Rejected,
            reason: eventItem.failure.errorMessage
              ? `Template rendering failure "${eventItem.failure.templateName}": ${eventItem.failure.errorMessage}`
              : `Template rendering failure "${eventItem.failure.templateName}"`,
          },
        ]);
        publishMetrics([
          {
            name: ConfigSetProcessorMetricName.EmailRenderingFailure,
            dimensions: {
              tenantName: emailRecord.tenantName,
              clientId: emailRecord.clientId,
            },
          },
        ]);
        break;
    }

    logger.info('End');
  } catch (error) {
    // For permanent errors swallow the error to avoid retries
    if (error instanceof PermanentEventError) {
      if (!error.context.silent) {
        logger.error(`Permanent error: ${error.message}`, {
          ...error.context,
          retryable: false,
        });
      }
      return;
    }
    // For other errors (retryable) just re-throw to trigger the retry mechanism of the batch processor
    throw error;
  }
};
