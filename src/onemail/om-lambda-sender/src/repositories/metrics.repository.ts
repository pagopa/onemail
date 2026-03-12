import env from '#config/env';
import { logger } from '#config/logger';
import { cloudWatchClient } from '#connector/cloudwatch.connector';
import {
  type MetricDatum,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';

export const SenderMetricName = {
  EmailNotFound: 'EmailNotFound',
  EmailBatchNotFound: 'EmailBatchNotFound',
  HighPriorityDispatched: 'HighPriorityDispatched',
  LowPriorityDispatched: 'LowPriorityDispatched',
  HighPriorityRejectedBySes: 'HighPriorityRejectedBySes',
  LowPriorityRejectedBySes: 'LowPriorityRejectedBySes',
  LowPriorityRetryableFailure: 'LowPriorityRetryableFailure',
  EmailStatusBatchUpdateFailed: 'EmailStatusBatchUpdateFailed',
  InvalidRecord: 'InvalidRecord',
} as const;

export type SenderMetricName =
  (typeof SenderMetricName)[keyof typeof SenderMetricName];

interface SenderMetricInput {
  name: SenderMetricName;
  value?: number;
}

const buildMetricDatum = ({
  name,
  value = 1,
}: SenderMetricInput): MetricDatum => ({
  MetricName: name,
  Unit: 'Count',
  Value: value,
  Timestamp: new Date(),
});

export const publishMetrics = async (
  metrics: SenderMetricInput[],
): Promise<void> => {
  const metricData = metrics
    .filter((metric) => metric.value && metric.value > 0)
    .map((metric) => buildMetricDatum(metric));

  if (metricData.length === 0) {
    return;
  }

  try {
    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: env.aws.cloudWatchMetricsNamespace,
        MetricData: metricData,
      }),
    );
  } catch (error) {
    logger.warn('Failed to publish CloudWatch metrics', {
      metricNames: metricData.map((metric) => metric.MetricName),
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
