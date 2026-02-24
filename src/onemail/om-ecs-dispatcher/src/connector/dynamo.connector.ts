import env from '#config/env';
import { NODE_ENV_VALUES } from '#utils/constants';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: env.aws.region,
  ...(env.server.environment === NODE_ENV_VALUES.local && {
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

export { dynamoClient };
