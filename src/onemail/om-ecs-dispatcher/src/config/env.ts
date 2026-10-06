import { APP_ENV_VALUES } from '#utils/constants';
import { configDotenv } from 'dotenv';

configDotenv();

const compileExcludedDomainsRegex = (
  value: string | undefined,
): RegExp | undefined => {
  const pattern = value?.trim();
  if (!pattern) return undefined;

  try {
    return new RegExp(pattern, 'i');
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid pattern';
    throw new Error(`Invalid EXCLUDED_DOMAINS_REGEX: ${reason}`);
  }
};

export default {
  projectVersion: process.env.npm_package_version || '1.0.0',
  server: {
    PORT: Number(process.env.PORT) || 3000,
    host: process.env.HOST || 'http://localhost:3000',
    environment: process.env.APP_ENV || APP_ENV_VALUES.local,
  },
  recipientDomains: {
    excludedDomainsRegex: compileExcludedDomainsRegex(
      process.env.EXCLUDED_DOMAINS_REGEX,
    ),
  },
  aws: {
    region: process.env.AWS_REGION ?? throwMissingRequiredEnvVar('AWS_REGION'),
    emailDbTable:
      process.env.AWS_EMAIL_DB_TABLE ??
      throwMissingRequiredEnvVar('AWS_EMAIL_DB_TABLE'),
    emailDbRequestIdGSI:
      process.env.AWS_EMAIL_DB_REQUEST_ID_GSI ??
      throwMissingRequiredEnvVar('AWS_EMAIL_DB_REQUEST_ID_GSI'),
    tenantConfigurationTable:
      process.env.AWS_TENANT_CONFIG_TABLE ??
      throwMissingRequiredEnvVar('AWS_TENANT_CONFIG_TABLE'),
    tenantDbConfigurationTenantNameGSI:
      process.env.AWS_TENANT_DB_CONFIG_TENANT_NAME_GSI ??
      throwMissingRequiredEnvVar('AWS_TENANT_DB_CONFIG_TENANT_NAME_GSI'),
    attachmentsBucket:
      process.env.AWS_ATTACHMENTS_BUCKET ??
      throwMissingRequiredEnvVar('AWS_ATTACHMENTS_BUCKET'),
    blacklistDbTable:
      process.env.AWS_BLACKLIST_DB_TABLE ??
      throwMissingRequiredEnvVar('AWS_BLACKLIST_DB_TABLE'),
    localDynamoDb: {
      endpoint: process.env.AWS_DYNAMODB_ENDPOINT || 'http://localhost:8000',
      accessKeyId: process.env.AWS_DYNAMODB_ACCESS_KEY_ID || 'local',
      secretAccessKey: process.env.AWS_DYNAMODB_SECRET_ACCESS_KEY || 'local',
    },
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
