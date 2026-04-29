import type { Context, SQSEvent, SQSHandler, SQSRecord } from 'aws-lambda';

import env from '#config/env';
import { addLambdaContextToLogger, getLogger } from '#config/logger';
import { RetryableEmailError } from '#errors/retryableEmail.error';
import { handleEmailRecordByPriority } from '#services/priority.service';
import {
  BatchProcessor,
  EventType,
  processPartialResponse,
} from '@aws-lambda-powertools/batch';
import middy from '@middy/core';
import {
  flushMetrics,
  publishMetrics,
  SenderMetricName,
} from 'om-common/repositories';

const logger = getLogger();

// Custom global error handler
class CustomBatchProcessor extends BatchProcessor {
  override failureHandler(record: SQSRecord, error: Error) {
    if (error instanceof RetryableEmailError) {
      logger.error(`Retryable error: ${error.message}`, {
        ...error.context,
        error: error.cause,
        retryable: true,
      });
    } else {
      publishMetrics([
        {
          name: SenderMetricName.UnexpectedRetryableError,
        },
      ]);
      logger.error('Unexpected error, will be retried', {
        body: record.body,
        error,
        retryable: true,
      });
    }
    return super.failureHandler(record, error);
  }
}

const processor = new CustomBatchProcessor(EventType.SQS);

const lambdaHandler: SQSHandler = async (event: SQSEvent, context: Context) => {
  addLambdaContextToLogger(context);
  const isHighPriority = event.Records[0].eventSourceARN.includes(
    env.sqs.highPriorityQueueARN,
  );

  const recordHandler = (record: SQSRecord) =>
    handleEmailRecordByPriority(record, isHighPriority);

  // TODO: idempotency with @aws-lambda-powertools/idempotency
  return processPartialResponse(event, recordHandler, processor, {
    context,
  });
};

export const handler = middy(lambdaHandler).use(flushMetrics);
