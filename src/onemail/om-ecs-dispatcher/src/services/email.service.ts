import env from '#config/env';
import { dynamoClient } from '#connector/dynamo.connector';
import {
  SendEmailTransactionalBody,
  SendEmailTransactionalRes,
} from '#dtos/email/emailTransactional.dto';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

export const sendEmailTransactional = async (
  emailData: SendEmailTransactionalBody,
): Promise<SendEmailTransactionalRes> => {
  const id = randomUUID();
  const tableName = env.aws.emailDbTable;

  await dynamoClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        id,
        ...emailData,
      },
    }),
  );

  return { id };
};
