import env from '#config/env';
import { getLogger } from '#config/logger';
import { dynamoClient } from '#connectors/dynamo.connector';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { type BlacklistItem } from 'om-common/types';

const logger = getLogger();

const normalizeEmailAddress = (emailAddress: string): string => {
  const openingBracketIndex = emailAddress.lastIndexOf('<');
  const closingBracketIndex = emailAddress.indexOf('>', openingBracketIndex);
  const address =
    openingBracketIndex >= 0 && closingBracketIndex > openingBracketIndex
      ? emailAddress.slice(openingBracketIndex + 1, closingBracketIndex)
      : emailAddress;

  return address.trim().toLowerCase();
};

/**
 * Adds an address to the blacklist mirroring the SES account-level suppression list.
 * The write is idempotent: an address already present is left untouched.
 */
export const addToBlacklist = async (
  blackListItem: BlacklistItem,
): Promise<void> => {
  const item: BlacklistItem = {
    emailAddress: normalizeEmailAddress(blackListItem.emailAddress),
    tenantName: blackListItem.tenantName,
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

    logger.debug('Address already present in the blacklist');
  }
};
