import type { Context, SQSEvent, SQSHandler } from 'aws-lambda';

import env from '#config/env';
import { addLambdaContextToLogger } from '#config/logger';
import { flushMetrics } from '#repositories/metrics.repository';
import {
  handleHighPriority,
  handleLowPriority,
} from '#services/priority.service';
import {
  BatchProcessor,
  EventType,
  processPartialResponse,
} from '@aws-lambda-powertools/batch';
import middy from '@middy/core';

const processor = new BatchProcessor(EventType.SQS);

//todo do error handler but exclude some SES errors
const lambdaHandler: SQSHandler = async (event: SQSEvent, context: Context) => {
  addLambdaContextToLogger(context);
  const isHighPriority = event.Records[0].eventSourceARN.includes(
    env.sqs.highPriorityQueueARN,
  );

  const recordHandler = isHighPriority ? handleHighPriority : handleLowPriority;

  // TODO: idempotency with @aws-lambda-powertools/idempotency
  return processPartialResponse(event, recordHandler, processor, {
    context,
  });
};

export const handler = middy(lambdaHandler).use(flushMetrics);
