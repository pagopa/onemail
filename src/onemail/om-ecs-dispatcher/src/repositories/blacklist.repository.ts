import type { BlacklistItem } from 'om-common/types';

import env from '#config/env';
import { getNamedLogger } from '#config/logger';
import { dynamoClient } from '#connectors/dynamo.connector';
import { BatchGetCommand } from '@aws-sdk/lib-dynamodb';

const MAX_RETRIES = 3;

const normalizeEmailAddress = (emailAddress: string): string =>
  emailAddress.trim().toLowerCase();

const fetchBlacklistItems = async (
  addresses: string[],
): Promise<BlacklistItem[]> => {
  const logger = getNamedLogger(fetchBlacklistItems.name);
  const found: BlacklistItem[] = [];

  let keys = addresses.map((emailAddress) => ({ emailAddress }));

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const result = await dynamoClient.send(
      new BatchGetCommand({
        RequestItems: {
          [env.aws.blacklistDbTable]: {
            Keys: keys,
          },
        },
      }),
    );

    found.push(
      ...((result.Responses?.[env.aws.blacklistDbTable] ??
        []) as BlacklistItem[]),
    );

    const unprocessed =
      result.UnprocessedKeys?.[env.aws.blacklistDbTable]?.Keys;
    if (!unprocessed || unprocessed.length === 0) {
      return found;
    }

    keys = unprocessed as { emailAddress: string }[];

    if (attempt >= MAX_RETRIES) {
      logger.warn('Giving up on unprocessed blacklist keys', {
        unprocessedCount: keys.length,
      });
      return found;
    }
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

  const results = await fetchBlacklistItems(uniqueAddresses);

  return new Map(
    results.map((item): [string, BlacklistItem] => [
      normalizeEmailAddress(item.emailAddress),
      item,
    ]),
  );
};
