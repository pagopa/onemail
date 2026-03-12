import env from '#config/env';
import { dynamoClient } from '#connector/dynamo.connector';
import { sqsClient } from '#connector/sqs.connector';
import {
  EmailHighPriorityBodyDTO,
  EmailHighPriorityResponseDTO,
} from '#dtos/email/emailHighPriority.dto';
import {
  EmailLowPriorityBodyDTO,
  EmailLowPriorityResponseDTO,
} from '#dtos/email/emailLowPriority.dto';
import { EmailStatusResponseDTO } from '#dtos/email/emailStatus.dto';
import { ERROR_CODES } from '#dtos/error.dto';
import { ApiError } from '#errors/ApiError';
import {
  mapEmailLowPriorityToDbItem,
  mapEmailTransactionalToDbItem,
} from '#utils/dbMapper';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import {
  BatchWriteCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { StatusCodes } from 'http-status-codes';
import { randomUUID } from 'node:crypto';
import { EmailStatusHistoryItem } from 'om-common/types';

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

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: env.aws.sqs.highPriorityQueueUrl,
      MessageBody: JSON.stringify({ emailId: dbObj.emailId }),
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

  //TODO - handle unprocessed items in the response and retry logic if needed
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

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: env.aws.sqs.lowPriorityQueueUrl,
      MessageBody: JSON.stringify({ requestId: requestId }),
    }),
  );

  return { requestId };
};

export const getEmailStatus = async (
  requestId: string,
): Promise<EmailStatusResponseDTO> => {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: env.aws.emailDbTable,
      IndexName: env.aws.emailDbRequestIdGSI,
      KeyConditionExpression: '#requestId = :requestId',
      ExpressionAttributeNames: {
        '#requestId': 'requestId',
      },
      ExpressionAttributeValues: {
        ':requestId': requestId,
      },
      Limit: 1,
    }),
  );

  const statusItem = result.Items?.[0] as EmailStatusHistoryItem | undefined;

  if (!statusItem) {
    throw new ApiError(
      `Email with requestId ${requestId} not found`,
      StatusCodes.NOT_FOUND,
      ERROR_CODES.RESOURCE_NOT_FOUND,
    );
  }

  return {
    status: statusItem.status,
    priority: statusItem.priority,
    history: statusItem.history,
  };
};
