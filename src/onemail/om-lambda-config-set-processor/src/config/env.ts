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
    scheduler: {
      highPriorityQueueArn:
        process.env.SQS_HIGH_PRIORITY_QUEUE_ARN ??
        throwMissingRequiredEnvVar('SQS_HIGH_PRIORITY_QUEUE_ARN'),
      lowPriorityQueueArn:
        process.env.SQS_LOW_PRIORITY_QUEUE_ARN ??
        throwMissingRequiredEnvVar('SQS_LOW_PRIORITY_QUEUE_ARN'),
      roleArn:
        process.env.EVENTBRIDGE_SCHEDULER_ROLE_ARN ??
        throwMissingRequiredEnvVar('EVENTBRIDGE_SCHEDULER_ROLE_ARN'),
      groupName: process.env.SCHEDULER_GROUP_NAME || 'default',
    },
    softBounce: {
      highPriorityBaseDelayMinutes:
        Number(process.env.SOFT_BOUNCE_HIGH_PRIORITY_BASE_DELAY_MINUTES) || 1,
      lowPriorityBaseDelayMinutes:
        Number(process.env.SOFT_BOUNCE_LOW_PRIORITY_BASE_DELAY_MINUTES) || 15,
      highPriorityMaxWindowDays:
        Number(process.env.SOFT_BOUNCE_HIGH_PRIORITY_MAX_WINDOW_DAYS) || 30,
      lowPriorityMaxAttempts:
        Number(process.env.SOFT_BOUNCE_LOW_PRIORITY_MAX_ATTEMPTS) || 5,
    },
  },
};

function throwMissingRequiredEnvVar(varName: string): never {
  throw new Error(`Missing required env var: ${varName}`);
}
