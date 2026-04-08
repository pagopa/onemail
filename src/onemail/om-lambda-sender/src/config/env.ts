import { SQS_QUEUE_ARN } from '#utils/constants';

export default {
  projectVersion: process.env.npm_package_version || '1.0.0',
  aws: {
    emailDbTable:
      process.env.AWS_EMAIL_DB_TABLE ??
      throwMissingRequiredEnvVar('AWS_EMAIL_DB_TABLE'),
    emailDbRequestIdGSI:
      process.env.AWS_EMAIL_DB_REQUEST_ID_GSI ??
      throwMissingRequiredEnvVar('AWS_EMAIL_DB_REQUEST_ID_GSI'),
    cloudWatchMetricsNamespace:
      process.env.AWS_CLOUDWATCH_METRICS_NAMESPACE ||
      'lambda-sender/ApplicationMetrics', //TODO: reimplement throw when infra is ready
    // ?? throwMissingRequiredEnvVar('AWS_CLOUDWATCH_METRICS_NAMESPACE'),
    configurationSetName:
      process.env.TMP_CONFIGURATION_SET_NAME ??
      throwMissingRequiredEnvVar('TMP_CONFIGURATION_SET_NAME'),
    tenantName:
      process.env.TMP_TENANT_NAME ??
      throwMissingRequiredEnvVar('TMP_TENANT_NAME'),
  },
  sqs: {
    highPriorityQueueARN:
      process.env[SQS_QUEUE_ARN.high] ??
      throwMissingRequiredEnvVar('SQS_HIGH_PRIORITY_QUEUE_ARN'),
    lowPriorityQueueARN:
      process.env[SQS_QUEUE_ARN.low] ??
      throwMissingRequiredEnvVar('SQS_LOW_PRIORITY_QUEUE_ARN'),
  },
};

function throwMissingRequiredEnvVar(varName: string): never {
  throw new Error(`Missing required env var: ${varName}`);
}
