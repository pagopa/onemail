export default {
  projectVersion: process.env.npm_package_version || '1.0.0',
  aws: {
    cloudWatchMetricsNamespace:
      process.env.AWS_CLOUDWATCH_METRICS_NAMESPACE ||
      'lambda-config-set-processor/ApplicationMetrics', //TODO: reimplement throw when infra is ready
    // ?? throwMissingRequiredEnvVar('AWS_CLOUDWATCH_METRICS_NAMESPACE'),
    lambdaPrefix:
      process.env.LAMBDA_PREFIX ?? throwMissingRequiredEnvVar('LAMBDA_PREFIX'),
  },
};

function throwMissingRequiredEnvVar(varName: string): never {
  throw new Error(`Missing required env var: ${varName}`);
}
