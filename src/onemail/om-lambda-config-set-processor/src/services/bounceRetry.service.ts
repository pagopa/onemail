import type { EmailEvent } from 'om-common/types';

import env from '#config/env';
import { getLogger, getNamedLogger } from '#config/logger';
import { sqsClient } from '#connectors/sqs.connector';
import {
  findEmailBySesMessageId,
  updateEmailStatusBySesMessageId,
} from '#repositories/email.repository';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import {
  ConfigSetProcessorMetricName,
  publishMetrics,
} from 'om-common/repositories';
import { EmailPriority, EmailStatus } from 'om-common/types';

import {
  HIGH_PRIORITY_MAX_ATTEMPTS,
  LOW_PRIORITY_MAX_ATTEMPTS,
} from '../utils/constants.js';

const logger = getLogger();

const countSoftBounceAttempts = (history: EmailEvent[]): number =>
  history.filter((event) => event.status === EmailStatus.SoftBounce).length;

export const handleSoftBounceRetry = async (
  sesMessageId: string,
  bounceTimestamp: string,
  bounceSubType?: string | null,
): Promise<void> => {
  const emailRecord = await findEmailBySesMessageId(sesMessageId);
  // Error
  if (!emailRecord) {
    logger.error('Email record not found', { sesMessageId });
    publishMetrics([
      {
        name: ConfigSetProcessorMetricName.MissingEmailRecordForRetry,
      },
    ]);
    return;
  }
  logger.debug('Retrieved email record', { sesMessageId });

  // Retry logic
  const { emailId, priority, history, requestId } = emailRecord;
  const softBounceCount = countSoftBounceAttempts(history);
  const newAttemptNumber = softBounceCount + 1;

  const bSubType = bounceSubType ?? undefined;
  if (priority === EmailPriority.HIGH) {
    await handleHighPriorityRetry(
      emailId,
      sesMessageId,
      bounceTimestamp,
      bSubType,
      newAttemptNumber,
    );
  } else {
    await handleLowPriorityRetry(
      emailId,
      requestId,
      sesMessageId,
      bounceTimestamp,
      bSubType,
      newAttemptNumber,
    );
  }
};

//High priority
const handleHighPriorityRetry = async (
  emailId: string,
  sesMessageId: string,
  bounceTimestamp: string,
  bounceSubType: string | undefined,
  attempt: number,
): Promise<void> => {
  const logger = getNamedLogger(handleHighPriorityRetry.name);
  logger.info('Start');

  if (attempt > HIGH_PRIORITY_MAX_ATTEMPTS) {
    logger.warn(
      'High-priority soft bounce max attempts reached, escalating to MaxRetriesReached',
      {
        emailId,
        sesMessageId,
        attempt,
        highPriorityMaxAttempts: HIGH_PRIORITY_MAX_ATTEMPTS,
      },
    );

    await updateEmailStatusBySesMessageId(sesMessageId, [
      {
        timestamp: bounceTimestamp,
        status: EmailStatus.SoftBounce,
        reason: bounceSubType,
      },
      {
        timestamp: bounceTimestamp,
        status: EmailStatus.MaxRetriesReached,
        reason: `SoftBounce escalated to MaxRetriesReached after ${attempt} attempts`,
      },
    ]);
    // Publish MaxRetriesReached metric for high priority
    publishMetrics([
      {
        name: ConfigSetProcessorMetricName.HighPriorityEmailMaxRetriesReached,
      },
    ]);
    return;
  }

  // 2. Enqueue the retry
  await scheduleRetry(emailId, EmailPriority.HIGH, attempt, {
    emailId,
  });

  // 3. DB update
  await updateEmailStatusBySesMessageId(sesMessageId, [
    {
      timestamp: bounceTimestamp,
      status: EmailStatus.SoftBounce,
      reason: bounceSubType,
    },
    {
      timestamp: new Date().toISOString(),
      status: EmailStatus.Queued,
      reason: `Queued for high-priority soft bounce retry attempt ${attempt}`,
    },
  ]);

  publishMetrics([
    {
      name: ConfigSetProcessorMetricName.EmailHighPriorityRetry,
      dimensions: {
        attempt: attempt.toString(),
      },
    },
  ]);

  logger.info('End');
};

//Low priority
const handleLowPriorityRetry = async (
  emailId: string,
  requestId: string,
  sesMessageId: string,
  bounceTimestamp: string,
  bounceSubType: string | undefined,
  attempt: number,
): Promise<void> => {
  const logger = getNamedLogger(handleLowPriorityRetry.name);
  logger.info('Start');

  // 1. Check if max attempts reached
  if (attempt > LOW_PRIORITY_MAX_ATTEMPTS) {
    logger.warn(
      'Low-priority soft bounce max attempts reached, escalating to MaxRetriesReached',
      {
        emailId,
        sesMessageId,
        attempt,
        lowPriorityMaxAttempts: LOW_PRIORITY_MAX_ATTEMPTS,
      },
    );

    await updateEmailStatusBySesMessageId(sesMessageId, [
      {
        timestamp: bounceTimestamp,
        status: EmailStatus.SoftBounce,
        reason: bounceSubType,
      },
      {
        timestamp: bounceTimestamp,
        status: EmailStatus.MaxRetriesReached,
        reason: `SoftBounce escalated to MaxRetriesReached after ${attempt} attempts`,
      },
    ]);

    // Publish MaxRetriesReached metric for low priority
    publishMetrics([
      {
        name: ConfigSetProcessorMetricName.LowPriorityEmailMaxRetriesReached,
      },
    ]);

    return;
  }

  // 2. Enqueue the retry
  await scheduleRetry(requestId, EmailPriority.LOW, attempt, {
    requestId,
  });

  // 3. DB update
  await updateEmailStatusBySesMessageId(sesMessageId, [
    {
      timestamp: bounceTimestamp,
      status: EmailStatus.SoftBounce,
      reason: bounceSubType,
    },
    {
      timestamp: new Date().toISOString(),
      status: EmailStatus.Queued,
      reason: `Queued for low-priority soft bounce retry attempt ${attempt}`,
    },
  ]);

  publishMetrics([
    {
      name: ConfigSetProcessorMetricName.EmailLowPriorityRetry,
      dimensions: {
        attempt: attempt.toString(),
      },
    },
  ]);

  logger.info('End');
};

// Schedule email retry via SQS using a fixed 15-minute delay.
const scheduleRetry = async (
  scheduleKey: string,
  priority: EmailPriority,
  attempt: number,
  input: Record<string, string>,
): Promise<void> => {
  try {
    const queueUrl =
      priority === EmailPriority.HIGH
        ? env.aws.sqs.highPriorityQueueUrl
        : env.aws.sqs.lowPriorityQueueUrl;

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(input),
        DelaySeconds: 900, // 15 minutes
      }),
    );

    logger.info('Soft bounce retry scheduled via SQS', {
      scheduleKey,
      priority,
      attempt,
      delaySeconds: 900,
      input,
    });
  } catch (error) {
    logger.error('Failed to schedule retry via SQS', {
      scheduleKey,
      attempt,
      error,
    });

    publishMetrics([
      {
        name: ConfigSetProcessorMetricName.ScheduleRetryFailed,
        dimensions: {
          reason: 'SqsSendMessageFailed',
        },
      },
    ]);

    throw error;
  }
};
