export default {
  projectVersion: process.env.npm_package_version || '1.0.0',
  aws: {
    cloudWatchMetricsNamespace:
      process.env.AWS_CLOUDWATCH_METRICS_NAMESPACE ??
      throwMissingRequiredEnvVar('AWS_CLOUDWATCH_METRICS_NAMESPACE'),
    servicePrefix:
      process.env.SERVICE_PREFIX ??
      throwMissingRequiredEnvVar('SERVICE_PREFIX'),
  },
};

function throwMissingRequiredEnvVar(varName: string): never {
  throw new Error(`Missing required env var: ${varName}`);
}
