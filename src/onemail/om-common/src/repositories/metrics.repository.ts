import type { MiddlewareLikeObj } from '@aws-lambda-powertools/commons/types';

import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';

import { metricsClient } from '../connectors/cloudwatch.connector.js';
import { EmailPriority, EmailStatus } from '../types/emailStatusHistory.js';

/**
 * Explicitly flush all stored metrics.
 * Use in long-running processes (e.g. ECS tasks) where there is no
 * Lambda-invocation boundary and the middy `logMetrics` middleware
 * is not available.
 * No-op if there are no metrics to publish.
 */
export const forceFlushMetrics = (): void => {
  if (!metricsClient.hasStoredMetrics()) {
    return;
  }

  metricsClient.publishStoredMetrics();
};

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
  EmailRejected: `Email${EmailStatus.Rejected}`,
  EmailRenderingFailure: `EmailRenderingFailure`,
  // Email Errors
  HighPriorityEmailMaxRetriesReached: `${PriorityPrefix[EmailPriority.HIGH]}${EmailStatus.MaxRetriesReached}`,
  LowPriorityEmailMaxRetriesReached: `${PriorityPrefix[EmailPriority.LOW]}${EmailStatus.MaxRetriesReached}`,
  EmailNotFound: 'EmailNotFound',
  InvalidRecord: 'InvalidRecord',
  MissingEmailRecordForRetry: 'MissingEmailRecordForRetry',
  // Other Errors
  ScheduleRetryFailed: 'ScheduleRetryFailed',
  EmailAlreadyQueued: 'EmailAlreadyQueued',
} as const;

export const SenderMetricName = {
  // High priority
  HighPriorityDispatched: `${PriorityPrefix[EmailPriority.HIGH]}${EmailStatus.Dispatched}`,
  HighPriorityDryRunError: `${PriorityPrefix[EmailPriority.HIGH]}${EmailStatus.DryRunError}`,
  HighPriorityRejected: `${PriorityPrefix[EmailPriority.HIGH]}${EmailStatus.Rejected}`,
  // Low priority
  LowPriorityDispatched: `${PriorityPrefix[EmailPriority.LOW]}${EmailStatus.Dispatched}`,
  LowPriorityDryRunError: `${PriorityPrefix[EmailPriority.LOW]}${EmailStatus.DryRunError}`,
  LowPriorityRejected: `${PriorityPrefix[EmailPriority.LOW]}${EmailStatus.Rejected}`,
  LowPriorityRetryableFailure: `${PriorityPrefix[EmailPriority.LOW]}RetryableFailure`,
  // Errors
  EmailBatchNotFound: 'EmailBatchNotFound',
  EmailNotFound: 'EmailNotFound',
  EmailStatusBatchUpdateFailed: 'EmailStatusBatchUpdateFailed',
  InvalidRecord: 'InvalidRecord',
} as const;

export const DispatcherMetricName = {
  HighPriorityAccepted: `${PriorityPrefix[EmailPriority.HIGH]}Accepted`,
  LowPriorityAccepted: `${PriorityPrefix[EmailPriority.LOW]}Accepted`,
  EmailStatusNotFound: 'EmailStatusNotFound',
  MultipleTenantForClient: 'MultipleTenantForClient',
  TenantConfigurationNotFound: 'TenantConfigurationNotFound',
  UnauthorizedTenant: 'UnauthorizedTenant',
} as const;

interface MetricInput {
  name: AllMetricNames;
  value?: number;
  dimensions?: Record<string, string>;
}

type AllMetricNames =
  | ConfigSetProcessorMetricName
  | DispatcherMetricName
  | SenderMetricName;

type ConfigSetProcessorMetricName =
  (typeof ConfigSetProcessorMetricName)[keyof typeof ConfigSetProcessorMetricName];

type DispatcherMetricName =
  (typeof DispatcherMetricName)[keyof typeof DispatcherMetricName];

type SenderMetricName =
  (typeof SenderMetricName)[keyof typeof SenderMetricName];
