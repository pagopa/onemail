import type { BlacklistItem } from 'om-common/types';

import env from '#config/env';
import { getLogger } from '#config/logger';
import { dynamoClient } from '#connectors/dynamo.connector';
import { BatchGetCommand } from '@aws-sdk/lib-dynamodb';

const logger = getLogger();

const normalizeEmailAddress = (emailAddress: string): string =>
  emailAddress.trim().toLowerCase();

const fetchBlacklistItems = async (
  addresses: string[],
): Promise<BlacklistItem[]> => {
  const result = await dynamoClient.send(
    new BatchGetCommand({
      RequestItems: {
        [env.aws.blacklistDbTable]: {
          Keys: addresses.map((emailAddress) => ({ emailAddress })),
        },
      },
    }),
  );

  const unprocessed = result.UnprocessedKeys?.[env.aws.blacklistDbTable]?.Keys;
  if (unprocessed?.length) {
    logger.warn('Some blacklist entries were not processed', {
      unprocessedCount: unprocessed.length,
    });
  }

  return (result.Responses?.[env.aws.blacklistDbTable] ??
    []) as BlacklistItem[];
};

export const findBlacklistedAddresses = async (
  addresses: string[],
): Promise<Set<string>> => {
  const uniqueAddresses = [...new Set(addresses.map(normalizeEmailAddress))];
  if (uniqueAddresses.length === 0) {
    return new Set();
  }

  const results = await fetchBlacklistItems(uniqueAddresses);

  return new Set(
    results.map((item) => normalizeEmailAddress(item.emailAddress)),
  );
};
