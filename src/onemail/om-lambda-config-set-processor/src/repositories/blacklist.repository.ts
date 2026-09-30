import env from '#config/env';
import { getLogger } from '#config/logger';
import { dynamoClient } from '#connectors/dynamo.connector';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { type BlacklistItem, BlacklistSource } from 'om-common/types';
import { maskEmailAddress, normalizeEmailAddress } from 'om-common/utils';

const logger = getLogger();

export interface AddToBlacklistInput {
  emailAddress: string;
  source: BlacklistSource;
  reason?: string;
  bounceSubType?: string;
  tenantName?: string;
}

/**
 * Adds an address to the blacklist mirroring the SES account-level suppression list.
 * The write is idempotent: an address already present is left untouched.
 */
export const addToBlacklist = async ({
  emailAddress,
  source,
  reason,
  bounceSubType,
  tenantName,
}: AddToBlacklistInput): Promise<void> => {
  const normalizedAddress = normalizeEmailAddress(emailAddress);
  const now = new Date().toISOString();

  const item: BlacklistItem = {
    emailAddress: normalizedAddress,
    source,
    reason,
    bounceSubType,
    tenantName,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await dynamoClient.send(
      new PutCommand({
        TableName: env.aws.blacklistDbTable,
        Item: item,
        ConditionExpression: 'attribute_not_exists(emailAddress)',
      }),
    );
  } catch (error) {
    if (!(error instanceof ConditionalCheckFailedException)) {
      throw error;
    }

    logger.debug('Address already present in the blacklist', {
      emailAddress: maskEmailAddress(normalizedAddress),
    });
  }
};
