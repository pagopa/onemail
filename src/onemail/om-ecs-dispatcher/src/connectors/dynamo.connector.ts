import env from '#config/env';
import { APP_ENV_VALUES } from '#utils/constants';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: env.aws.region,
  ...(env.server.environment === APP_ENV_VALUES.local && {
    endpoint: env.aws.localDynamoDb.endpoint,
    credentials: {
      accessKeyId: env.aws.localDynamoDb.accessKeyId,
      secretAccessKey: env.aws.localDynamoDb.secretAccessKey,
    },
  }),
});
const dynamoClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

// TODO: check if we need a separate client for the template registry and align the regions
const templateDynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: env.aws.templateRegistry.primaryRegion,
    maxAttempts: 3,
    requestHandler: {
      connectionTimeout: 1000,
      requestTimeout: 3000,
      throwOnRequestTimeout: true,
    },
    ...(env.server.environment === APP_ENV_VALUES.local && {
      endpoint: env.aws.localDynamoDb.endpoint,
      credentials: {
        accessKeyId: env.aws.localDynamoDb.accessKeyId,
        secretAccessKey: env.aws.localDynamoDb.secretAccessKey,
      },
    }),
  }),
);

export { dynamoClient, templateDynamoClient };
