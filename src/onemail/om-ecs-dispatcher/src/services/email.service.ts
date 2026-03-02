import env from '#config/env';
import { dynamoClient } from '#connector/dynamo.connector';
import {
  EmailHighPriorityBodyDTO,
  EmailHighPriorityResponseDTO,
} from '#dtos/email/emailHighPriority.dto';
import { mapEmailTransactionalToDbItem } from '#utils/dbMapper';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

export const sendEmailTransactional = async (
  emailData: EmailHighPriorityBodyDTO,
  dryRun: boolean,
): Promise<EmailHighPriorityResponseDTO> => {
  const emailId = randomUUID();
  const requestId = randomUUID();
  const clientId = 'clientIdMock';
  const tableName = env.aws.emailDbTable;

  const dbObj = mapEmailTransactionalToDbItem(
    emailData,
    emailId,
    requestId,
    clientId,
    dryRun,
  );

  await dynamoClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        ...dbObj,
      },
    }),
  );

  return { requestId };
};
