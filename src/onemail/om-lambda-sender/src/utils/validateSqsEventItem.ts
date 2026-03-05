import { SqsEventItem, SqsEventItemSchema } from '#dtos/sqsEventItem';
import { SQSRecord } from 'aws-lambda';
import { isEmpty } from 'lodash';

export const validateSqsEventItem = (
  item: SQSRecord,
): { valid: boolean; item?: SqsEventItem } => {
  if (isEmpty(item.body)) {
    return { valid: false };
  }

  const validationResult = SqsEventItemSchema.safeParse(JSON.parse(item.body));
  if (!validationResult.success) {
    return { valid: false };
  }
  return { valid: true, item: validationResult.data };
};
