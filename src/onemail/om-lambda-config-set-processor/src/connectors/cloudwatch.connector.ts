import env from '#config/env';
import { Metrics } from '@aws-lambda-powertools/metrics';

export const metricsClient = new Metrics({
  namespace: 'lambda',
  serviceName: env.aws.cloudWatchMetricsNamespace,
});
