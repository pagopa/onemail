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
import { BatchWriteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
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

  // BatchWriteCommand max chunk size is 25
  const DYNAMO_BATCH_LIMIT = 25;
  // Split dbListObj into batches of max 25 items
  const batches: (typeof dbListObj)[] = [];
  for (let i = 0; i < dbListObj.length; i += DYNAMO_BATCH_LIMIT) {
    batches.push(dbListObj.slice(i, i + DYNAMO_BATCH_LIMIT));
  }

  await Promise.all(
    batches.map((batch) =>
      dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              PutRequest: {
                Item: { ...item },
              },
            })),
          },
        }),
      ),
    ),
  );

  return { requestId };
};
