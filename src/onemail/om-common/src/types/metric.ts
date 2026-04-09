import { EmailPriority, EmailStatus } from './emailStatusHistory.js';

const PriorityPrefix = {
  [EmailPriority.HIGH]: 'HighPriority',
  [EmailPriority.LOW]: 'LowPriority',
} as const;

export const ConfigSetProcessorMetricName = {
  // Success
  EmailDelivered: `Email${EmailStatus.Delivered}`,
  // Bounce
  EmailHardBounce: `Email${EmailStatus.HardBounce}`,
  EmailSoftBounce: `Email${EmailStatus.SoftBounce}`,
  EmailComplaint: `Email${EmailStatus.Complaint}`,
  // Email Errors
  HighPriorityEmailMaxRetriesReached: `${PriorityPrefix[EmailPriority.HIGH]}${EmailStatus.MaxRetriesReached}`,
  LowPriorityEmailMaxRetriesReached: `${PriorityPrefix[EmailPriority.LOW]}${EmailStatus.MaxRetriesReached}`,
  EmailNotFound: 'EmailNotFound',
  InvalidRecord: 'InvalidRecord',
  MissingEmailRecordForRetry: 'MissingEmailRecordForRetry',
  // Other Errors
  ScheduleRetryFailed: 'ScheduleRetryFailed',
} as const;

export const SenderMetricName = {
  // High priority
  HighPriorityDispatched: `${PriorityPrefix[EmailPriority.HIGH]}${EmailStatus.Dispatched}`,
  HighPriorityDryRunError: `${PriorityPrefix[EmailPriority.HIGH]}${EmailStatus.DryRunError}`,
  HighPriorityRejectedBySES: `${PriorityPrefix[EmailPriority.HIGH]}${EmailStatus.RejectedBySES}`,
  // Low priority
  LowPriorityDispatched: `${PriorityPrefix[EmailPriority.LOW]}${EmailStatus.Dispatched}`,
  LowPriorityDryRunError: `${PriorityPrefix[EmailPriority.LOW]}${EmailStatus.DryRunError}`,
  LowPriorityRejectedBySES: `${PriorityPrefix[EmailPriority.LOW]}${EmailStatus.RejectedBySES}`,
  LowPriorityRetryableFailure: `${PriorityPrefix[EmailPriority.LOW]}RetryableFailure`,
  // Errors
  EmailBatchNotFound: 'EmailBatchNotFound',
  EmailNotFound: 'EmailNotFound',
  EmailStatusBatchUpdateFailed: 'EmailStatusBatchUpdateFailed',
  InvalidRecord: 'InvalidRecord',
} as const;

export type SenderMetricName =
  (typeof SenderMetricName)[keyof typeof SenderMetricName];

export const MetricName = {
  ...ConfigSetProcessorMetricName,
  ...SenderMetricName,
} as const;

export interface ConfigSetProcessorMetricInput {
  name: CustomMetric;
  value?: number;
  dimensions?: Record<string, string>;
}

export type CustomMetric = MetricName;

export type MetricName = (typeof MetricName)[keyof typeof MetricName];

export interface SenderMetricInput {
  name: CustomMetric;
  value?: number;
  dimensions?: Record<string, string>;
}
