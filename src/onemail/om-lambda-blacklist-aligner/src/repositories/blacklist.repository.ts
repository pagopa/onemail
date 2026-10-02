import type { BlacklistItem } from 'om-common/types';

import env from '#config/env';
import { getNamedLogger } from '#config/logger';
import { dynamoClient } from '#connectors/dynamo.connector';
import { BatchWriteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { setTimeout as delay } from 'node:timers/promises';

const DYNAMO_BATCH_LIMIT = 25;
const MAX_CONCURRENT_BATCHES = 4;
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 200;
const MAX_BACKOFF_MS = 5000;

type BlacklistPutRequest = {
  PutRequest: { Item: BlacklistItem };
};

export interface BlacklistSummaryItem {
  emailAddress: string;
}

const processBatchWithRetry = async (
  initialRequests: BlacklistPutRequest[],
): Promise<void> => {
  const logger = getNamedLogger(processBatchWithRetry.name);
  let pendingRequests = initialRequests;

  for (let retryCount = 0; pendingRequests.length > 0; retryCount += 1) {
    const response = await dynamoClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [env.aws.blacklistDbTable]: pendingRequests,
        },
      }),
    );
    pendingRequests =
      (response.UnprocessedItems?.[env.aws.blacklistDbTable] as
        | BlacklistPutRequest[]
        | undefined) ?? [];

    if (pendingRequests.length === 0) {
      return;
    }

    if (retryCount === MAX_RETRIES) {
      throw new Error(
        `Failed to insert ${pendingRequests.length} blacklist addresses after ${MAX_RETRIES} retries`,
      );
    }

    logger.warn('Retrying unprocessed blacklist addresses', {
      retryCount: retryCount + 1,
      pendingAddresses: pendingRequests.length,
    });

    const backoffCapMs = Math.min(
      BASE_BACKOFF_MS * 2 ** retryCount,
      MAX_BACKOFF_MS,
    );
    await delay(Math.floor(Math.random() * (backoffCapMs + 1)));
  }
};

const processBatchesWithConcurrency = async (
  batches: BlacklistPutRequest[][],
): Promise<void> => {
  let nextBatchIndex = 0;
  const workerCount = Math.min(MAX_CONCURRENT_BATCHES, batches.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextBatchIndex < batches.length) {
      const batch = batches[nextBatchIndex];
      nextBatchIndex += 1;
      await processBatchWithRetry(batch);
    }
  });

  await Promise.all(workers);
};

/** Reads every blacklisted address with the attributes needed by the diff. */
export const scanAllBlacklistedAddresses = async (): Promise<
  BlacklistSummaryItem[]
> => {
  const logger = getNamedLogger(scanAllBlacklistedAddresses.name);
  const items: BlacklistSummaryItem[] = [];

  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const page = await dynamoClient.send(
      new ScanCommand({
        TableName: env.aws.blacklistDbTable,
        ProjectionExpression: 'emailAddress',
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    items.push(...((page.Items ?? []) as BlacklistSummaryItem[]));
    exclusiveStartKey = page.LastEvaluatedKey;
  } while (exclusiveStartKey);

  logger.info('Blacklist table scanned');

  return items;
};

export const putBlacklistItems = async (
  items: BlacklistItem[],
): Promise<number> => {
  if (items.length === 0) {
    return 0;
  }

  const requests = items.map(
    (item): BlacklistPutRequest => ({ PutRequest: { Item: item } }),
  );
  const batches: BlacklistPutRequest[][] = [];

  for (let index = 0; index < requests.length; index += DYNAMO_BATCH_LIMIT) {
    batches.push(requests.slice(index, index + DYNAMO_BATCH_LIMIT));
  }

  await processBatchesWithConcurrency(batches);
  return items.length;
};
