import { metricsClient } from '#connectors/cloudwatch.connector';
import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import isEmpty from 'lodash-es/isEmpty.js';
import { ConfigSetProcessorMetricInput } from 'om-common/types';

export const publishMetrics = (
  metricsInput: ConfigSetProcessorMetricInput[],
): void => {
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
