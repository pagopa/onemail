import env from '#config/env';
import { getLogger } from '#config/logger';
import { dynamoClient } from '#connectors/dynamo.connector';
import {
  BatchWriteCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import isEmpty from 'lodash-es/isEmpty.js';
import {
  ConfigSetProcessorMetricName,
  publishMetrics,
} from 'om-common/repositories';
import { EmailStatus, type EmailStatusHistoryItem } from 'om-common/types';

const logger = getLogger();

export const findEmailBySesMessageId = async (
  sesMessageId: string,
): Promise<EmailStatusHistoryItem | undefined> => {
  // Query the email record by SES message ID using the GSI
  const queryResult = await dynamoClient.send(
    new QueryCommand({
      TableName: env.aws.emailDbTable,
      IndexName: env.aws.emailDbMessageIdGSI,
      KeyConditionExpression: '#sesMessageId = :sesMessageId',
      ExpressionAttributeNames: {
        '#sesMessageId': 'sesMessageId',
      },
      ExpressionAttributeValues: {
        ':sesMessageId': sesMessageId,
      },
      Limit: 1,
    }),
  );

  const item = queryResult.Items?.[0] as EmailStatusHistoryItem | undefined;
  if (!item) {
    publishMetrics([
      {
        name: ConfigSetProcessorMetricName.EmailNotFound,
      },
    ]);
    logger.warn('No email record found for SES message Id', { sesMessageId });
  }

  return item;
};

export const updateEmailStatusBySesMessageId = async (
  sesMessageId: string,
  updates: {
    timestamp: string;
    status: EmailStatus;
    reason?: string | null;
  }[],
): Promise<void> => {
  if (isEmpty(updates)) {
    return;
  }
  const item = await findEmailBySesMessageId(sesMessageId);
  if (!item) {
    return;
  }

  // Takes the timestamp closest to the present. In the event of a tie, it takes the last one in the array
  const currentUpdate = updates.reduce((latest, current) =>
    new Date(current.timestamp).getTime() >=
    new Date(latest.timestamp).getTime()
      ? current
      : latest,
  );

  // Guard: skip update for Delivered if the current status is not Dispatched.
  // Prevents a late delivery event from overwriting a bounce/complaint that arrived first
  // e.g. queued → dispatched → complaint → [late] delivered -- in this case should stay complaint
  if (
    currentUpdate.status === EmailStatus.Delivered &&
    item.status !== EmailStatus.Dispatched
  ) {
    return;
  }

  // TODO: skip update if new status is delivery and current status is complaint or bounce

  // Update the email record with the new status and timestamp
  await dynamoClient.send(
    new UpdateCommand({
      TableName: env.aws.emailDbTable,
      Key: { emailId: item.emailId },
      UpdateExpression:
        'SET #status = :status, #updatedAt = :updatedAt, #history = list_append(if_not_exists(#history, :emptyList), :newHistoryItems)',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#history': 'history',
      },
      ExpressionAttributeValues: {
        ':status': currentUpdate.status,
        ':updatedAt': currentUpdate.timestamp,
        ':emptyList': [],
        ':newHistoryItems': updates.map(({ status, timestamp, reason }) => ({
          status,
          changedAt: timestamp,
          reason: reason ?? undefined,
        })),
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
  const tableName = env.aws.emailDbTable;
  const now = new Date().toISOString();

  if (isEmpty(updates)) {
    return;
  }

  const items = updates.map(({ item, status, messageId }) => {
    // Append the new status to the existing history array
    const updatedHistory = item.history ? [...item.history] : [];
    updatedHistory.push({
      status,
      changedAt: now,
    });

    return {
      PutRequest: {
        Item: {
          ...item,
          status,
          updatedAt: now,
          sesMessageId: messageId ?? item.sesMessageId,
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
