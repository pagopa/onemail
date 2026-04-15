export default {
  projectVersion: process.env.npm_package_version || '1.0.0',
  aws: {
    region: process.env.AWS_REGION ?? throwMissingRequiredEnvVar('AWS_REGION'),
    emailDbTable:
      process.env.AWS_EMAIL_DB_TABLE ??
      throwMissingRequiredEnvVar('AWS_EMAIL_DB_TABLE'),
    emailDbMessageIdGSI:
      process.env.AWS_EMAIL_DB_MESSAGE_ID_GSI ??
      throwMissingRequiredEnvVar('AWS_EMAIL_DB_MESSAGE_ID_GSI'),
    sqs: {
      highPriorityQueueUrl:
        process.env.SQS_HIGH_PRIORITY_QUEUE_URL ??
        throwMissingRequiredEnvVar('SQS_HIGH_PRIORITY_QUEUE_URL'),
      lowPriorityQueueUrl:
        process.env.SQS_LOW_PRIORITY_QUEUE_URL ??
        throwMissingRequiredEnvVar('SQS_LOW_PRIORITY_QUEUE_URL'),
    },
  },
};

function throwMissingRequiredEnvVar(varName: string): never {
  throw new Error(`Missing required env var: ${varName}`);
}
