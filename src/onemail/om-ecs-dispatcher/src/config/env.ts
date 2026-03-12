import { NODE_ENV_VALUES } from '#utils/constants';
import { configDotenv } from 'dotenv';

configDotenv();

export default {
  projectVersion: process.env.npm_package_version || '1.0.0',
  server: {
    PORT: Number(process.env.PORT) || 3000,
    host: process.env.HOST || 'http://localhost:3000',
    environment: process.env.NODE_ENV || NODE_ENV_VALUES.local,
  },
  aws: {
    region: process.env.AWS_REGION ?? throwMissingRequiredEnvVar('AWS_REGION'),
    emailDbTable:
      process.env.AWS_EMAIL_DB_TABLE ??
      throwMissingRequiredEnvVar('AWS_EMAIL_DB_TABLE'),
    emailDbRequestIdGSI:
      process.env.AWS_EMAIL_DB_REQUEST_ID_GSI ??
      throwMissingRequiredEnvVar('AWS_EMAIL_DB_REQUEST_ID_GSI'),
    localDynamoDb: {
      endpoint: process.env.AWS_DYNAMODB_ENDPOINT || 'http://localhost:8000',
      accessKeyId: process.env.AWS_DYNAMODB_ACCESS_KEY_ID || 'local',
      secretAccessKey: process.env.AWS_DYNAMODB_SECRET_ACCESS_KEY || 'local',
    },
  },
};

function throwMissingRequiredEnvVar(varName: string): never {
  throw new Error(`Missing required env var: ${varName}`);
}
