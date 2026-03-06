import type { Context, SQSEvent, SQSHandler, SQSRecord } from 'aws-lambda';

import env from '#config/env';
import { logger } from '#config/logger';
import { handleByPriority } from '#services/priority.service';
import {
  BatchProcessor,
  EventType,
  processPartialResponse,
} from '@aws-lambda-powertools/batch';

const processor = new BatchProcessor(EventType.SQS);

//todo do error handler but exclude some SES errors
export const handler: SQSHandler = async (
  event: SQSEvent,
  context: Context,
) => {
  logger.addContext(context);
  const isHighPriority = event.Records[0].eventSourceARN.includes(
    env.sqs.highPriorityQueueARN,
  );

  // TODO: idempotency with @aws-lambda-powertools/idempotency
  processPartialResponse(
    event,
    (record: SQSRecord) => handleByPriority(record, isHighPriority),
    processor,
    {
      context,
    },
  );
};
