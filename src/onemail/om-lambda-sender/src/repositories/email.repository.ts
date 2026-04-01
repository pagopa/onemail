import type { EmailStatus, EmailStatusHistoryItem } from 'om-common/types';

import env from '#config/env';
import { getLogger, getNamedLogger } from '#config/logger';
import { dynamoClient } from '#connector/dynamo.connector';
import {
  BatchWriteCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { publishMetrics, SenderMetricName } from './metrics.repository.js';

const logger = getLogger();

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

export const updateEmailStatus = async ({
  emailId,
  status,
  messageId,
  reason,
}: {
  emailId: string;
  status: EmailStatus;
  messageId?: string;
  reason?: string;
}): Promise<void> => {
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
        ':newHistoryItem': [{ status, changedAt: now, reason }],
      },
    }),
  );
};

export interface EmailStatusUpdate {
  item: EmailStatusHistoryItem;
  status: EmailStatus;
  messageId?: string;
  reason?: string;
}

const DYNAMO_BATCH_LIMIT = 25;
const MAX_RETRIES = 3;

/**
 * Batch-update email statuses using BatchWriteCommand requests.
 * Retries only unprocessed items with exponential backoff.
 */
const processBatchWithRetry = async (
  tableName: string,
  initialRequests: { PutRequest: { Item: EmailStatusHistoryItem } }[],
): Promise<void> => {
  let pendingRequests = initialRequests;
  let retryCount = 0;

  while (pendingRequests.length > 0 && retryCount <= MAX_RETRIES) {
    const response = await dynamoClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: pendingRequests,
        },
      }),
    );

    // Extract unprocessed items directly
    const unprocessedRequests =
      (response.UnprocessedItems?.[tableName] as typeof initialRequests) ?? [];

    if (unprocessedRequests.length === 0) {
      return;
    }

    retryCount++;
    pendingRequests = unprocessedRequests;

    if (retryCount > MAX_RETRIES) {
      await publishMetrics([
        {
          name: SenderMetricName.EmailStatusBatchUpdateFailed,
        },
      ]);
      throw new Error(
        `Failed to update ${pendingRequests.length} email statuses after ${MAX_RETRIES} retries. Email IDs: ${pendingRequests
          .map((req) => req.PutRequest.Item.emailId)
          .join(', ')}`,
      );
    }

    logger.warn(
      'Retrying unprocessed email status updates after DynamoDB throttling',
      {
        retryCount,
        emailIds: pendingRequests.map((req) => req.PutRequest.Item.emailId),
      },
    );
  }
};

/**
 * Batch-update email statuses using BatchWriteCommand requests.
 * Chunks requests into batches of 25 and retries unprocessed items.
 * Individual batch failures are logged and then propagated to the caller.
 */
export const batchUpdateEmailStatuses = async (
  updates: EmailStatusUpdate[],
): Promise<void> => {
  const logger = getNamedLogger(batchUpdateEmailStatuses.name);
  const tableName = env.aws.emailDbTable;
  const now = new Date().toISOString();

  if (updates.length === 0) {
    return;
  }

  const items = updates.map(({ item, status, messageId, reason }) => {
    // Append the new status to the existing history array
    const updatedHistory = item.history ? [...item.history] : [];
    updatedHistory.push({
      status,
      changedAt: now,
      reason,
    });

    return {
      PutRequest: {
        Item: {
          ...item,
          status,
          updatedAt: now,
          messageId: messageId ?? null,
          history: updatedHistory,
        },
      },
    };
  });

  const batches: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += DYNAMO_BATCH_LIMIT) {
    batches.push(items.slice(i, i + DYNAMO_BATCH_LIMIT));
  }

  const results = await Promise.allSettled(
    batches.map((batch) => processBatchWithRetry(tableName, batch)),
  );
  const failedBatchErrors: Error[] = [];

  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      const failedEmailIds = batches[index].map(
        (i) => i.PutRequest.Item.emailId,
      );
      logger.error('BatchWriteCommand failed for batch', {
        batchIndex: index,
        emailIds: failedEmailIds,
        error: result.reason?.message || result.reason,
      });

      failedBatchErrors.push(
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason)),
      );
    }
  }

  if (failedBatchErrors.length > 0) {
    throw new AggregateError(
      failedBatchErrors,
      `Failed to update ${failedBatchErrors.length} email status batch${failedBatchErrors.length > 1 ? 'es' : ''}.`,
    );
  }
};
