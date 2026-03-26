export default {
  projectVersion: process.env.npm_package_version || '1.0.0',
  aws: {
    emailDbTable:
      process.env.AWS_EMAIL_DB_TABLE ??
      throwMissingRequiredEnvVar('AWS_EMAIL_DB_TABLE'),
    emailDbMessageIdGSI:
      process.env.AWS_EMAIL_DB_MESSAGE_ID_GSI ??
      throwMissingRequiredEnvVar('AWS_EMAIL_DB_MESSAGE_ID_GSI'),
    cloudWatchMetricsNamespace:
      process.env.AWS_CLOUDWATCH_METRICS_NAMESPACE ||
      'lambda-config-set-processor/ApplicationMetrics', //TODO: reimplement throw when infra is ready
    // ?? throwMissingRequiredEnvVar('AWS_CLOUDWATCH_METRICS_NAMESPACE'),
  },
};

function throwMissingRequiredEnvVar(varName: string): never {
  throw new Error(`Missing required env var: ${varName}`);
}
