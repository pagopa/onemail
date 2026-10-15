import env from '#config/env';
import { dynamoClient } from '#connectors/dynamo.connector';
import { FINAL_EMAIL_STATUSES } from '#utils/constants';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const FINAL_STATUS_PLACEHOLDERS = FINAL_EMAIL_STATUSES.map(
  (_, index) => `:finalStatus${index}`,
);

const FINAL_STATUS_VALUES = Object.fromEntries(
  FINAL_EMAIL_STATUSES.map((status, index) => [
    FINAL_STATUS_PLACEHOLDERS[index],
    status,
  ]),
);

/**
 * Sets the TTL attribute only once, so retries never move the expiration forward.
 * Returns false when the TTL is already set or the email no longer exists.
 */
export const setEmailExpirationTime = async (
  emailId: string,
  expirationTime: number,
): Promise<boolean> => {
  try {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: env.aws.emailDbTable,
        Key: { emailId },
        UpdateExpression: 'SET #expirationTime = :expirationTime',
        ConditionExpression:
          'attribute_exists(#emailId) AND attribute_not_exists(#expirationTime)',
        ExpressionAttributeNames: {
          '#emailId': 'emailId',
          '#expirationTime': 'expiration_time',
        },
        ExpressionAttributeValues: { ':expirationTime': expirationTime },
        ReturnValues: 'NONE',
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
};

/**
 * Returns true when another email of the same request is not in a final status yet.
 */
export const hasOpenEmailsInRequest = async (
  requestId: string,
  excludedEmailId: string,
): Promise<boolean> => {
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await dynamoClient.send(
      new QueryCommand({
        TableName: env.aws.emailDbTable,
        IndexName: env.aws.emailDbRequestIdGSI,
        KeyConditionExpression: '#requestId = :requestId',
        FilterExpression: `#emailId <> :excludedEmailId AND NOT (#status IN (${FINAL_STATUS_PLACEHOLDERS.join(', ')}))`,
        ExpressionAttributeNames: {
          '#requestId': 'requestId',
          '#emailId': 'emailId',
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':requestId': requestId,
          ':excludedEmailId': excludedEmailId,
          ...FINAL_STATUS_VALUES,
        },
        Select: 'COUNT',
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    if ((response.Count ?? 0) > 0) return true;
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return false;
};
