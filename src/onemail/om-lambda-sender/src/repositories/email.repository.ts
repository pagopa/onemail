import type { EmailStatus, EmailStatusHistoryItem } from 'om-common/types';

import env from '#config/env';
import { logger } from '#config/logger';
import { dynamoClient } from '#connector/dynamo.connector';
import {
  BatchWriteCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

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

export const getEmailsByRequestId = async (
  requestId: string,
): Promise<EmailStatusHistoryItem[]> => {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: env.aws.emailDbTable,
      IndexName: env.aws.emailDbRequestIdGSI,
      KeyConditionExpression: '#requestId = :requestId',
      FilterExpression: '#status = :queued',
      ExpressionAttributeNames: {
        '#requestId': 'requestId',
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':requestId': requestId,
        ':queued': 'Queued',
      },
    }),
  );

  return (result.Items as EmailStatusHistoryItem[]) ?? [];
};

// update email status in db - to be implemented
// add messageId
export const updateEmailStatus = async (
  emailId: string,
  status: EmailStatus,
  messageId?: string,
): Promise<void> => {
  const now = new Date().toISOString();
  await dynamoClient.send(
    new UpdateCommand({
      TableName: env.aws.emailDbTable,
      Key: { emailId },
      UpdateExpression:
        'SET #status = :status, #updatedAt = :updatedAt, #sesMessageId = :sesMessageId, #history = list_append(if_not_exists(#history, :emptyList), :newHistoryItem)',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#sesMessageId': 'sesMessageId',
        '#history': 'history',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': now,
        ':sesMessageId': messageId || null,
        ':emptyList': [],
        ':newHistoryItem': [{ status, changedAt: now }],
      },
    }),
  );
};

export interface EmailStatusUpdate {
  item: EmailStatusHistoryItem;
  status: EmailStatus;
  messageId?: string;
}

const DYNAMO_BATCH_LIMIT = 25;

/**
 * Batch-update email statuses using BatchWriteCommand (PutRequest).
 * Chunks into batches of 25 (DynamoDB limit).
 * Individual batch failures are logged but do not fail the entire operation.
 */
export const batchUpdateEmailStatuses = async (
  updates: EmailStatusUpdate[],
): Promise<void> => {
  const tableName = env.aws.emailDbTable;
  const now = new Date().toISOString();

  const items = updates.map(({ item, status, messageId }) => {
    // Append the new status to the existing history array
    const updatedHistory = item.history ? [...item.history] : [];
    updatedHistory.push({
      status,
      changedAt: now,
    });

    return {
      ...item,
      status,
      updatedAt: now,
      sesMessageId: messageId ?? null,
      history: updatedHistory,
    };
  });

  const batches: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += DYNAMO_BATCH_LIMIT) {
    batches.push(items.slice(i, i + DYNAMO_BATCH_LIMIT));
  }

  //TODO - handle unprocessed items in the response and retry logic if needed
  const results = await Promise.allSettled(
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

  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      const failedEmailIds = batches[index].map((i) => i.emailId);
      logger.error('BatchWriteCommand failed for batch', {
        batchIndex: index,
        emailIds: failedEmailIds,
        error: result.reason,
      });
    }
  }
};
