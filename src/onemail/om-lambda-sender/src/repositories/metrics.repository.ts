import { metricsClient } from '#connectors/cloudwatch.connector';
import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import isEmpty from 'lodash-es/isEmpty.js';

export enum SenderMetricName {
  EmailBatchNotFound = 'EmailBatchNotFound',
  EmailNotFound = 'EmailNotFound',
  EmailStatusBatchUpdateFailed = 'EmailStatusBatchUpdateFailed',
  HighPriorityDispatched = 'HighPriorityDispatched',
  HighPriorityDryRunError = 'HighPriorityDryRunError',
  HighPriorityRejectedBySes = 'HighPriorityRejectedBySes',
  InvalidRecord = 'InvalidRecord',
  LowPriorityDispatched = 'LowPriorityDispatched',
  LowPriorityDryRunError = 'LowPriorityDryRunError',
  LowPriorityRejectedBySes = 'LowPriorityRejectedBySes',
  LowPriorityRetryableFailure = 'LowPriorityRetryableFailure',
}

interface SenderMetricInput {
  name: SenderMetricName;
  value?: number;
  dimensions?: Record<string, string>;
}

export const publishMetrics = (metricsInput: SenderMetricInput[]): void => {
  if (isEmpty(metricsInput)) {
    return;
  }

  const singleMetric = metricsClient.singleMetric();

  metricsInput.forEach((metric) => {
    singleMetric.addDimensions(metric.dimensions ?? {});
    singleMetric.addMetric(metric.name, MetricUnit.Count, metric.value ?? 1);
  });
};

export const flushMetrics = logMetrics([metricsClient]);
