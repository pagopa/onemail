import type { EmailStatus, EmailStatusHistoryItem } from 'om-common/types';

import env from '#config/env';
import { dynamoClient } from '#connector/dynamo.connector';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

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

// update email status in db - to be implemented
// add messageId
export const updateEmailStatus = async (
  emailId: string,
  status: EmailStatus,
  messageId?: string,
): Promise<void> => {
  await dynamoClient.send(
    new UpdateCommand({
      TableName: env.aws.emailDbTable,
      Key: { emailId },
      UpdateExpression:
        'SET #status = :status, #updatedAt = :updatedAt, #sesMessageId = :sesMessageId',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#sesMessageId': 'sesMessageId',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': new Date().toISOString(),
        ':sesMessageId': messageId || null,
      },
    }),
  );
};
