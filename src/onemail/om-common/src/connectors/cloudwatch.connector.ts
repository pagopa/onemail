import { Metrics } from '@aws-lambda-powertools/metrics';

import env from '../config/env.js';

export const metricsClient = new Metrics({
  namespace: env.aws.lambdaPrefix,
  serviceName: env.aws.cloudWatchMetricsNamespace,
});
