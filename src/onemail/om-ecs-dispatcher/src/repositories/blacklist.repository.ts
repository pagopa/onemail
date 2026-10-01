import type { BlacklistItem } from 'om-common/types';

import env from '#config/env';
import { getNamedLogger } from '#config/logger';
import { dynamoClient } from '#connectors/dynamo.connector';
import { BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { setTimeout as delay } from 'node:timers/promises';
import { normalizeEmailAddress } from 'om-common/utils';

// BatchGetItem accepts at most 100 keys per request.
const BATCH_GET_LIMIT = 100;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 50;
const MAX_BACKOFF_MS = 400;

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const fetchChunk = async (
  addresses: string[],
  tableName: string,
): Promise<BlacklistItem[]> => {
  const logger = getNamedLogger(fetchChunk.name);
  const found: BlacklistItem[] = [];

  let keys = addresses.map((emailAddress) => ({ emailAddress }));

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const result = await dynamoClient.send(
      new BatchGetCommand({
        RequestItems: {
          [tableName]: {
            Keys: keys,
            ProjectionExpression: 'emailAddress, reason',
          },
        },
      }),
    );

    found.push(...((result.Responses?.[tableName] ?? []) as BlacklistItem[]));

    const unprocessed = result.UnprocessedKeys?.[tableName]?.Keys;
    if (!unprocessed || unprocessed.length === 0) {
      return found;
    }

    keys = unprocessed as { emailAddress: string }[];

    if (attempt === MAX_RETRIES) {
      logger.warn('Giving up on unprocessed blacklist keys', {
        unprocessedCount: keys.length,
      });
      return found;
    }

    await delay(Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS));
  }

  return found;
};

/**
 * Looks up the given recipients in the blacklist mirroring the SES suppression list.
 * Returns only the blacklisted ones, keyed by normalized address.
 */
export const findBlacklistedAddresses = async (
  addresses: string[],
): Promise<Map<string, BlacklistItem>> => {
  const uniqueAddresses = [...new Set(addresses.map(normalizeEmailAddress))];
  if (uniqueAddresses.length === 0) {
    return new Map();
  }

  const tableName = env.aws.blacklistDbTable;
  const results = await Promise.all(
    chunk(uniqueAddresses, BATCH_GET_LIMIT).map((addressChunk) =>
      fetchChunk(addressChunk, tableName),
    ),
  );

  return new Map(
    results
      .flat()
      .map((item) => [normalizeEmailAddress(item.emailAddress), item]),
  );
};
