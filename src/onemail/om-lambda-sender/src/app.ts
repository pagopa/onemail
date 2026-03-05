import type { SQSEvent, SQSHandler } from 'aws-lambda';

import env from '#config/env';
import { highPriorityHandler } from '#services/highPriority.service';
import { lowPriorityHandler } from '#services/lowPriority.service';
import {
  BatchProcessor,
  EventType,
  processPartialResponse,
} from '@aws-lambda-powertools/batch';

const processor = new BatchProcessor(EventType.SQS);

export const handler: SQSHandler = async (event: SQSEvent, context) => {
  const isHighPriority = event.Records[0].eventSourceARN.includes(
    env.sqs.highPriorityQueueARN,
  );

  processPartialResponse(
    event,
    isHighPriority ? highPriorityHandler : lowPriorityHandler,
    processor,
    {
      context,
    },
  );
};
