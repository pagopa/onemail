import type { EmailStatusHistoryItem } from 'om-common/types';

import env from '#config/env';
import { dynamoClient } from '#connector/dynamo.connector';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

// TODO: low timeout
export const getEmailById = async (
  emailId: string,
): Promise<EmailStatusHistoryItem | undefined> => {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: env.aws.emailDbTable,
      Key: { emailId },
      ConsistentRead: true,
    }),
  );

  return result.Item as EmailStatusHistoryItem | undefined;
};
