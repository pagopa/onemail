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
  },
  ses: {
    sesMultiRegionEndpointId: process.env.SES_MULTI_REGION_ENDPOINT_ID,
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
