import env from '#config/env';
import {
  ESCALATION_THRESHOLD_MINUTES,
  MILLISECONDS_PER_MINUTE,
} from '#utils/constants';
import { EmailEvent, EmailStatus } from 'om-common/types';

export const countSoftBounceAttempts = (history: EmailEvent[]): number =>
  history.filter((event) => event.status === EmailStatus.SoftBounce).length;

export const calculateExponentialDelay = (
  attempt: number,
  baseDelay: number,
  factor: number,
): number => baseDelay * Math.pow(factor, attempt - 1);

export const getFirstSoftBounceTimestamp = (
  history: EmailEvent[],
): string | undefined =>
  history
    .filter((event) => event.status === EmailStatus.SoftBounce)
    .map((event) => event.changedAt)
    .sort()[0];

export const getHighPriorityBaseDelay = (
  firstBounceMs: number | null,
  currentBounceMs: number,
): number => {
  // If there's no previous bounce, use the standard base delay
  if (!firstBounceMs) {
    return env.aws.softBounce.highPriorityBaseDelayMinutes;
  }

  const elapsedMs = currentBounceMs - firstBounceMs;
  const escalationThresholdMs =
    ESCALATION_THRESHOLD_MINUTES * MILLISECONDS_PER_MINUTE;

  return elapsedMs >= escalationThresholdMs
    ? env.aws.softBounce.highPriorityEscalatedBaseDelayMinutes
    : env.aws.softBounce.highPriorityBaseDelayMinutes;
};
