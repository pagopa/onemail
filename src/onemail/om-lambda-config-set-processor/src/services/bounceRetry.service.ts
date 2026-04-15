import type { EmailEvent } from 'om-common/types';

import env from '#config/env';
import { getLogger, getNamedLogger } from '#config/logger';
import { schedulerClient } from '#connectors/scheduler.connector';
import {
  findEmailBySesMessageId,
  updateEmailStatusBySesMessageId,
} from '#repositories/email.repository';
import { BACKOFF_FACTOR, MILLISECONDS_PER_DAY } from '#utils/constants';
import {
  calculateExponentialDelay,
  getHighPriorityBaseDelay,
} from '#utils/exponentialBackoff';
import {
  ActionAfterCompletion,
  ConflictException,
  CreateScheduleCommand,
  FlexibleTimeWindowMode,
} from '@aws-sdk/client-scheduler';
import {
  ConfigSetProcessorMetricName,
  publishMetrics,
} from 'om-common/repositories';
import { EmailPriority, EmailStatus } from 'om-common/types';

const logger = getLogger();

const getFirstSoftBounceTimestamp = (
  history: EmailEvent[],
): string | undefined =>
  history
    .filter((event) => event.status === EmailStatus.SoftBounce)
    .sort(
      (a, b) =>
        new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
    )[0]?.changedAt;

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
      history,
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

//High priority: exponential backoff for up to N days from the first SoftBounce.
// After N days, escalate to MaxRetriesReached.
const handleHighPriorityRetry = async (
  emailId: string,
  sesMessageId: string,
  bounceTimestamp: string,
  bounceSubType: string | undefined,
  history: EmailEvent[],
  attempt: number,
): Promise<void> => {
  const logger = getNamedLogger(handleHighPriorityRetry.name);
  logger.info('Start');

  // Get the timestamp of the first soft bounce, if any
  const firstSoftBounce = getFirstSoftBounceTimestamp(history);
  const firstBounceMs = firstSoftBounce
    ? new Date(firstSoftBounce).getTime()
    : null;

  const currentBounceMs = new Date(bounceTimestamp).getTime();

  // 1. Check if the max window has expired
  if (firstBounceMs) {
    const maxWindowMs =
      env.aws.softBounce.highPriorityMaxWindowDays * MILLISECONDS_PER_DAY;

    const isWindowExpired = currentBounceMs - firstBounceMs >= maxWindowMs;

    // If the retry window has expired, escalate to MaxRetriesReached without scheduling another retry
    if (isWindowExpired) {
      logger.warn(
        'High-priority soft bounce retry window exceeded, escalating to MaxRetriesReached',
        { emailId, sesMessageId, attempt, firstSoftBounce },
      );
      // Update status to SoftBounce and then MaxRetriesReached with appropriate reasons
      await updateEmailStatusBySesMessageId(sesMessageId, [
        {
          timestamp: bounceTimestamp,
          status: EmailStatus.SoftBounce,
          reason: bounceSubType,
        },
        {
          timestamp: bounceTimestamp,
          status: EmailStatus.MaxRetriesReached,
          reason: `SoftBounce escalated to MaxRetriesReached after ${attempt} attempts — retry window expired (${bounceSubType})`,
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
  }

  // 2. Calculate the delay
  const baseDelayMinutes = getHighPriorityBaseDelay(
    firstBounceMs,
    currentBounceMs,
  );
  const delayMinutes = calculateExponentialDelay(
    attempt,
    baseDelayMinutes,
    BACKOFF_FACTOR.HIGH_PRIORITY,
  );

  // 3. Eventbridge schedule
  await scheduleRetry(emailId, EmailPriority.HIGH, attempt, delayMinutes, {
    emailId,
  });

  // 4. DB update
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

//Low priority: exponential backoff up to max attempts.
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

  const { lowPriorityMaxAttempts, lowPriorityBaseDelayMinutes } =
    env.aws.softBounce;

  // 1. Check if max attempts reached
  if (attempt > lowPriorityMaxAttempts) {
    logger.warn(
      'Low-priority soft bounce max attempts reached, escalating to MaxRetriesReached',
      { emailId, sesMessageId, attempt, lowPriorityMaxAttempts },
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

  // 2. Calculate the delay
  const delayMinutes = calculateExponentialDelay(
    attempt,
    lowPriorityBaseDelayMinutes,
    BACKOFF_FACTOR.LOW_PRIORITY,
  );

  // 3. Eventbridge schedule
  await scheduleRetry(requestId, EmailPriority.LOW, attempt, delayMinutes, {
    requestId,
  });

  // 4. DB update
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

// Schedule email retry via EventBridge Scheduler.
// Uses a one-time schedule with auto-delete after completion.
const scheduleRetry = async (
  scheduleKey: string,
  priority: EmailPriority,
  attempt: number,
  delayMinutes: number,
  input: Record<string, string>,
): Promise<void> => {
  const scheduleTime = new Date(Date.now() + delayMinutes * 60 * 1000);
  const scheduleExpression = `at(${scheduleTime.toISOString().replace(/\.\d{3}Z$/, '')})`;
  const scheduleName = `retry-${scheduleKey}`;

  try {
    await schedulerClient.send(
      new CreateScheduleCommand({
        Name: scheduleName,
        GroupName: env.aws.scheduler.groupName,
        ScheduleExpression: scheduleExpression,
        ScheduleExpressionTimezone: 'UTC',
        FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
        ActionAfterCompletion: ActionAfterCompletion.DELETE,
        Description: `Schedule for retrying email with key ${scheduleKey} (attempt ${attempt}, priority ${priority})`,
        Target: {
          Arn:
            priority === EmailPriority.HIGH
              ? env.aws.scheduler.highPriorityQueueArn
              : env.aws.scheduler.lowPriorityQueueArn,
          RoleArn: env.aws.scheduler.roleArn,
          Input: JSON.stringify(input),
        },
      }),
    );

    logger.info('Soft bounce retry scheduled via EventBridge Scheduler', {
      scheduleKey,
      priority,
      attempt,
      delayMinutes,
      input,
      scheduleTime: scheduleTime.toISOString(),
    });
  } catch (error) {
    if (error instanceof ConflictException) {
      // Log the conflict but swallow the error to maintain idempotency.
      logger.warn('Schedule already exists, proceeding to ensure idempotency', {
        scheduleKey,
        attempt,
        scheduleName,
      });

      publishMetrics([
        {
          name: ConfigSetProcessorMetricName.ScheduleRetryFailed,
          dimensions: {
            reason: 'ScheduleAlreadyExists',
          },
        },
      ]);

      return;
    }
    throw error;
  }
};
