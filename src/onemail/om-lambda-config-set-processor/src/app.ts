import type { Context, SQSEvent, SQSHandler, SQSRecord } from 'aws-lambda';

import { addLambdaContextToLogger, getLogger } from '#config/logger';
import { sqsEventHandler } from '#services/emailStatus.service';
import {
  BatchProcessor,
  EventType,
  processPartialResponse,
} from '@aws-lambda-powertools/batch';
import middy from '@middy/core';
import { RetryableEventError } from 'om-common/errors';
import {
  ConfigSetProcessorMetricName,
  flushMetrics,
  publishMetrics,
} from 'om-common/repositories';

const logger = getLogger();

// Custom global error handler
class CustomBatchProcessor extends BatchProcessor {
  override failureHandler(record: SQSRecord, error: Error) {
    if (error instanceof RetryableEventError) {
      logger.error(`Retryable error: ${error.message}`, {
        ...error.context,
        error: error.cause,
        retryable: true,
      });
    } else {
      publishMetrics([
        {
          name: ConfigSetProcessorMetricName.UnexpectedRetryableError,
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

  // TODO: idempotency with @aws-lambda-powertools/idempotency
  return processPartialResponse(event, sqsEventHandler, processor, {
    context,
  });
};

export const handler = middy(lambdaHandler).use(flushMetrics);
