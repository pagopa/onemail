import type { Context, SQSEvent, SQSHandler } from 'aws-lambda';

import env from '#config/env';
import { logger } from '#config/logger';
import {
  handleHighPriority,
  handleLowPriority,
} from '#services/priority.service';
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

  const recordHandler = isHighPriority ? handleHighPriority : handleLowPriority;

  // TODO: idempotency with @aws-lambda-powertools/idempotency
  processPartialResponse(event, recordHandler, processor, {
    context,
  });
};
