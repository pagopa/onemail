import env from '#config/env';
import { Metrics } from '@aws-lambda-powertools/metrics';

export const metricsClient = new Metrics({
  namespace: env.aws.servicePrefix,
  serviceName: env.aws.cloudWatchMetricsNamespace,
});
