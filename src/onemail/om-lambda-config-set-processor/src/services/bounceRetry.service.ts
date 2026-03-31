import type { EmailEvent } from 'om-common/types';

import env from '#config/env';
import { logger } from '#config/logger';
import { schedulerClient } from '#connector/scheduler.connector';
import {
  findEmailBySesMessageId,
  updateEmailStatusBySesMessageId,
} from '#repositories/email.repository';
import {
  ActionAfterCompletion,
  CreateScheduleCommand,
  FlexibleTimeWindowMode,
} from '@aws-sdk/client-scheduler';
import { EmailPriority, EmailStatus } from 'om-common/types';

const MILLISECONDS_PER_DAY = 86_400_000;

export const countSoftBounceAttempts = (history: EmailEvent[]): number =>
  history.filter((event) => event.status === EmailStatus.SoftBounce).length;

export const calculateExponentialDelay = (
  attempt: number,
  baseDelay: number,
): number => baseDelay * Math.pow(2, attempt - 1);

export const getFirstSoftBounceTimestamp = (
  history: EmailEvent[],
): string | undefined =>
  history.find((event) => event.status === EmailStatus.SoftBounce)?.changedAt;

export const isWithinRetryWindow = (
  firstSoftBounceTimestamp: string,
  maxWindowMs: number,
  now: number = Date.now(),
): boolean => {
  const elapsed = now - new Date(firstSoftBounceTimestamp).getTime();
  return elapsed < maxWindowMs;
};

export const handleSoftBounceRetry = async (
  sesMessageId: string,
  bounceTimestamp: string,
  bounceSubType: string,
): Promise<void> => {
  logger.info('handleSoftBounceRetry - start');

  const emailRecord = await findEmailBySesMessageId(sesMessageId);
  if (!emailRecord) {
    return;
  }

  const { emailId, priority, history } = emailRecord;
  const softBounceCount = countSoftBounceAttempts(history);
  const newAttemptNumber = softBounceCount + 1;

  if (priority === EmailPriority.HIGH) {
    await handleHighPriorityRetry(
      emailId,
      sesMessageId,
      bounceTimestamp,
      bounceSubType,
      history,
      newAttemptNumber,
    );
  } else {
    await handleLowPriorityRetry(
      emailId,
      sesMessageId,
      bounceTimestamp,
      bounceSubType,
      newAttemptNumber,
    );
  }

  logger.info('handleSoftBounceRetry - end');
};

//High priority: exponential backoff for up to N days from the first SoftBounce. After N days, escalate to HardBounce.
const handleHighPriorityRetry = async (
  emailId: string,
  sesMessageId: string,
  bounceTimestamp: string,
  bounceSubType: string,
  history: EmailEvent[],
  attempt: number,
): Promise<void> => {
  logger.info('handleHighPriorityRetry - start');

  const firstSoftBounce = getFirstSoftBounceTimestamp(history);

  // If there is a previous SoftBounce, verify that the retry is within the allowed window.
  if (firstSoftBounce) {
    const maxWindowMs =
      env.aws.softBounce.highPriorityMaxWindowDays * MILLISECONDS_PER_DAY;

    if (!isWithinRetryWindow(firstSoftBounce, maxWindowMs)) {
      logger.warn(
        'High-priority soft bounce retry window exceeded, escalating to HardBounce',
        { emailId, sesMessageId, attempt, firstSoftBounce },
      );

      await updateEmailStatusBySesMessageId(
        sesMessageId,
        bounceTimestamp,
        EmailStatus.HardBounce,
        `SoftBounce escalated to HardBounce after ${attempt} attempts — retry window expired (${bounceSubType})`,
      );
      return;
    }
  }

  await updateEmailStatusBySesMessageId(
    sesMessageId,
    bounceTimestamp,
    EmailStatus.SoftBounce,
    bounceSubType,
  );

  const delayMinutes = calculateExponentialDelay(
    attempt,
    env.aws.softBounce.highPriorityBaseDelayMinutes,
  );

  await scheduleRetry(
    emailId,
    EmailPriority.HIGH,
    attempt,
    delayMinutes,
    env.aws.scheduler.highPriorityQueueArn,
  );

  logger.info('handleHighPriorityRetry - end');
};

//Low priority: exponential backoff up to max attempts.
const handleLowPriorityRetry = async (
  emailId: string,
  sesMessageId: string,
  bounceTimestamp: string,
  bounceSubType: string,
  attempt: number,
): Promise<void> => {
  logger.info('handleLowPriorityRetry - start');

  const { lowPriorityMaxAttempts } = env.aws.softBounce;

  if (attempt > lowPriorityMaxAttempts) {
    logger.warn(
      'Low-priority soft bounce max attempts reached, escalating to HardBounce',
      { emailId, sesMessageId, attempt, lowPriorityMaxAttempts },
    );

    await updateEmailStatusBySesMessageId(
      sesMessageId,
      bounceTimestamp,
      EmailStatus.HardBounce,
      `SoftBounce escalated to HardBounce after ${attempt} attempts (${bounceSubType})`,
    );
    return;
  }

  await updateEmailStatusBySesMessageId(
    sesMessageId,
    bounceTimestamp,
    EmailStatus.SoftBounce,
    bounceSubType,
  );

  const delayMinutes = calculateExponentialDelay(
    attempt,
    env.aws.softBounce.lowPriorityBaseDelayMinutes,
  );

  await scheduleRetry(
    emailId,
    EmailPriority.LOW,
    attempt,
    delayMinutes,
    env.aws.scheduler.lowPriorityQueueArn,
  );

  logger.info('handleLowPriorityRetry - end');
};

//Schedule email retry via EventBridge Scheduler. Uses a one-time schedule with auto-delete after completion.
const scheduleRetry = async (
  emailId: string,
  priority: EmailPriority,
  attempt: number,
  delayMinutes: number,
  targetQueueArn: string,
): Promise<void> => {
  logger.info('scheduleRetry - start');

  const scheduleTime = new Date(Date.now() + delayMinutes * 60 * 1000);
  const scheduleExpression = `at(${scheduleTime.toISOString().replace(/\.\d{3}Z$/, '')})`;
  const scheduleName = `soft-bounce-retry-${emailId}-attempt-${attempt}`;

  await schedulerClient.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      GroupName: env.aws.scheduler.groupName,
      ScheduleExpression: scheduleExpression,
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
      ActionAfterCompletion: ActionAfterCompletion.DELETE,
      Target: {
        Arn: targetQueueArn,
        RoleArn: env.aws.scheduler.roleArn,
        Input: JSON.stringify({ emailId }),
      },
    }),
  );

  logger.info('Soft bounce retry scheduled via EventBridge Scheduler', {
    emailId,
    priority,
    attempt,
    delayMinutes,
    targetQueueArn,
    scheduleTime: scheduleTime.toISOString(),
  });

  logger.info('scheduleRetry - end');
};
