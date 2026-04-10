import type { MiddlewareLikeObj } from '@aws-lambda-powertools/commons/types';

import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';

import { metricsClient } from '../connectors/cloudwatch.connector.js';
import { EmailPriority, EmailStatus } from '../types/emailStatusHistory.js';

export const publishMetrics = (metricsInput: MetricInput[]): void => {
  if (metricsInput.length === 0) {
    return;
  }

  const singleMetric = metricsClient.singleMetric();

  metricsInput.forEach((metric) => {
    singleMetric.addDimensions(metric.dimensions ?? {});
    singleMetric.addMetric(metric.name, MetricUnit.Count, metric.value ?? 1);
  });
};

export const flushMetrics: MiddlewareLikeObj = logMetrics([metricsClient]);

const PriorityPrefix = {
  [EmailPriority.HIGH]: 'HighPriority',
  [EmailPriority.LOW]: 'LowPriority',
} as const;

export const ConfigSetProcessorMetricName = {
  // Success
  EmailDelivered: `Email${EmailStatus.Delivered}`,
  EmailHighPriorityRetry: `${PriorityPrefix[EmailPriority.HIGH]}Retry`,
  EmailLowPriorityRetry: `${PriorityPrefix[EmailPriority.LOW]}Retry`,
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

interface MetricInput {
  name: AllMetricNames;
  value?: number;
  dimensions?: Record<string, string>;
}

type AllMetricNames = ConfigSetProcessorMetricName | SenderMetricName;

type ConfigSetProcessorMetricName =
  (typeof ConfigSetProcessorMetricName)[keyof typeof ConfigSetProcessorMetricName];

type SenderMetricName =
  (typeof SenderMetricName)[keyof typeof SenderMetricName];
