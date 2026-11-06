import env from '#config/env';
import { dynamoClient } from '#connectors/dynamo.connector';
import { FINAL_EMAIL_STATUSES } from '#utils/constants';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

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
 * Returns true when another email of the same request is not in a final status yet.
 */
export const hasNonFinalEmailsInRequest = async (
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
