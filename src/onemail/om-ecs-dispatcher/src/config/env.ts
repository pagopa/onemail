import { APP_ENV_VALUES } from '#utils/constants';
import { configDotenv } from 'dotenv';

configDotenv();

const localDefaults = {
  awsRegion: 'eu-south-1',
  attachmentsBucket: 'onemail-attachments-local',
  emailDbTable: 'EmailStatusHistory',
  emailDbRequestIdGSI: 'gsi_request_id_idx',
  tenantConfigurationTable: 'TenantConfig',
  tenantDbConfigurationTenantNameGSI: 'gsi_tenant_name_idx',
  highPriorityQueueUrl: 'http://localhost:9324/000000000000/high-priority',
  lowPriorityQueueUrl: 'http://localhost:9324/000000000000/low-priority',
};

export default {
  projectVersion: process.env.npm_package_version || '1.0.0',
  server: {
    PORT: Number(process.env.PORT) || 3000,
    host: process.env.HOST || 'http://localhost:3000',
    environment: process.env.APP_ENV || APP_ENV_VALUES.local,
  },
  aws: {
    region: getRequiredEnv('AWS_REGION', localDefaults.awsRegion),
    attachmentsBucket: getRequiredEnv(
      'AWS_ATTACHMENTS_BUCKET',
      localDefaults.attachmentsBucket,
    ),
    emailDbTable: getRequiredEnv(
      'AWS_EMAIL_DB_TABLE',
      localDefaults.emailDbTable,
    ),
    emailDbRequestIdGSI: getRequiredEnv(
      'AWS_EMAIL_DB_REQUEST_ID_GSI',
      localDefaults.emailDbRequestIdGSI,
    ),
    tenantConfigurationTable: getRequiredEnv(
      'AWS_TENANT_CONFIG_TABLE',
      localDefaults.tenantConfigurationTable,
    ),
    tenantDbConfigurationTenantNameGSI: getRequiredEnv(
      'AWS_TENANT_DB_CONFIG_TENANT_NAME_GSI',
      localDefaults.tenantDbConfigurationTenantNameGSI,
    ),
    localDynamoDb: {
      endpoint: process.env.AWS_DYNAMODB_ENDPOINT || 'http://localhost:8000',
      accessKeyId: process.env.AWS_DYNAMODB_ACCESS_KEY_ID || 'local',
      secretAccessKey: process.env.AWS_DYNAMODB_SECRET_ACCESS_KEY || 'local',
    },
    localS3: {
      endpoint: process.env.AWS_S3_ENDPOINT || 'http://localhost:9000',
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || 'local',
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || 'local',
    },
    localSqs: {
      endpoint: process.env.AWS_SQS_ENDPOINT || 'http://localhost:9324',
      accessKeyId: process.env.AWS_SQS_ACCESS_KEY_ID || 'local',
      secretAccessKey: process.env.AWS_SQS_SECRET_ACCESS_KEY || 'local',
    },
    sqs: {
      highPriorityQueueUrl: getRequiredEnv(
        'SQS_HIGH_PRIORITY_QUEUE_URL',
        localDefaults.highPriorityQueueUrl,
      ),
      lowPriorityQueueUrl: getRequiredEnv(
        'SQS_LOW_PRIORITY_QUEUE_URL',
        localDefaults.lowPriorityQueueUrl,
      ),
    },
  },
};

function getRequiredEnv(varName: string, fallback?: string): string {
  const value = process.env[varName] ?? fallback;

  if (value) {
    return value;
  }

  throwMissingRequiredEnvVar(varName);
}

function throwMissingRequiredEnvVar(varName: string): never {
  throw new Error(`Missing required env var: ${varName}`);
}
