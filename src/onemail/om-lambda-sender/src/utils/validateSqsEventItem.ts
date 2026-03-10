import {
  SqsEventItemHigh,
  SqsEventItemHighSchema,
  SqsEventItemLow,
  SqsEventItemLowSchema,
} from '#dtos/sqsEventItem';
import { SQSRecord } from 'aws-lambda';
import { isEmpty } from 'lodash';

export const validateSqsEventItem = (
  item: SQSRecord,
  isHighPriority: boolean,
): { valid: boolean; item?: SqsEventItemHigh | SqsEventItemLow } => {
  if (isEmpty(item.body)) {
    return { valid: false };
  }

  const validationResult = isHighPriority
    ? SqsEventItemHighSchema.safeParse(JSON.parse(item.body))
    : SqsEventItemLowSchema.safeParse(JSON.parse(item.body));

  if (!validationResult.success) {
    return { valid: false };
  }
  return { valid: true, item: validationResult.data };
};
