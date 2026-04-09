import type { Context, SQSEvent, SQSHandler } from 'aws-lambda';

import { addLambdaContextToLogger } from '#config/logger';
import { flushMetrics } from '#repositories/metrics.repository';
import { sqsEventHandler } from '#services/emailStatus.service';
import {
  BatchProcessor,
  EventType,
  processPartialResponse,
} from '@aws-lambda-powertools/batch';
import middy from '@middy/core';

const processor = new BatchProcessor(EventType.SQS);

const lambdaHandler: SQSHandler = async (event: SQSEvent, context: Context) => {
  addLambdaContextToLogger(context);

  // TODO: idempotency with @aws-lambda-powertools/idempotency
  return processPartialResponse(event, sqsEventHandler, processor, {
    context,
  });
};

export const handler = middy(lambdaHandler).use(flushMetrics);
