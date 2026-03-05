import { SQS_QUEUE_ARN } from '#utils/constants';

export default {
  projectVersion: process.env.npm_package_version || '1.0.0',
  aws: {
    region: process.env.AWS_REGION ?? throwMissingRequiredEnvVar('AWS_REGION'),
    emailDbTable:
      process.env.AWS_EMAIL_DB_TABLE ??
      throwMissingRequiredEnvVar('AWS_EMAIL_DB_TABLE'),
    localDynamoDb: {
      endpoint: process.env.AWS_DYNAMODB_ENDPOINT || 'http://localhost:8000',
      accessKeyId: process.env.AWS_DYNAMODB_ACCESS_KEY_ID || 'local',
      secretAccessKey: process.env.AWS_DYNAMODB_SECRET_ACCESS_KEY || 'local',
    },
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
