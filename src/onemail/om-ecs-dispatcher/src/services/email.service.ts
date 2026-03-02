import env from '#config/env';
import { dynamoClient } from '#connector/dynamo.connector';
import {
  EmailHighPriorityBodyDTO,
  EmailHighPriorityResponseDTO,
} from '#dtos/email/emailHighPriority.dto';
import {
  EmailLowPriorityBodyDTO,
  EmailLowPriorityResponseDTO,
} from '#dtos/email/emailLowPriority.dto';
import {
  mapEmailLowPriorityToDbItem,
  mapEmailTransactionalToDbItem,
} from '#utils/dbMapper';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

export const sendEmailTransactional = async (
  emailData: EmailHighPriorityBodyDTO,
  dryRun: boolean,
): Promise<EmailHighPriorityResponseDTO> => {
  const requestId = randomUUID();
  const clientId = 'clientIdMock';
  const tableName = env.aws.emailDbTable;

  const dbObj = mapEmailTransactionalToDbItem(
    emailData,
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

export const sendEmailLowPriority = async (
  emailData: EmailLowPriorityBodyDTO,
  dryRun: boolean,
): Promise<EmailLowPriorityResponseDTO> => {
  const requestId = randomUUID();
  const clientId = 'clientIdMock';
  const tableName = env.aws.emailDbTable;

  const dbListObj = mapEmailLowPriorityToDbItem(
    emailData,
    requestId,
    clientId,
    dryRun,
  );

  const uploadPromises = dbListObj.map((dbObj) =>
    dynamoClient.send(
      new PutCommand({
        TableName: tableName,
        Item: { ...dbObj },
      }),
    ),
  );

  await Promise.all(uploadPromises);

  return { requestId };
};
