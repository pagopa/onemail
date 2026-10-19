import type { Context, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';

import { addLambdaContextToLogger, getLogger } from '#config/logger';
import { dynamoStreamRecordHandler } from '#services/emailRetention.service';
import {
  BatchProcessor,
  EventType,
  processPartialResponse,
} from '@aws-lambda-powertools/batch';
import middy from '@middy/core';
import { RetryableEventError } from 'om-common/errors';
import {
  EmailRetentionMetricName,
  flushMetrics,
  publishMetrics,
} from 'om-common/repositories';

const logger = getLogger();

class CustomBatchProcessor extends BatchProcessor {
  override failureHandler(record: DynamoDBRecord, error: Error) {
    if (error instanceof RetryableEventError) {
      logger.error(`Retryable error: ${error.message}`, {
        ...error.context,
        error: error.cause,
        retryable: true,
      });
    } else {
      publishMetrics([
        {
          name: EmailRetentionMetricName.UnexpectedRetryableError,
        },
      ]);
      logger.error('Unexpected error, will be retried', {
        sequenceNumber: record.dynamodb?.SequenceNumber,
        error,
        retryable: true,
      });
    }
    return super.failureHandler(record, error);
  }
}

const processor = new CustomBatchProcessor(EventType.DynamoDBStreams);

const lambdaHandler = async (event: DynamoDBStreamEvent, context: Context) => {
  addLambdaContextToLogger(context);

  return processPartialResponse(event, dynamoStreamRecordHandler, processor, {
    context,
    throwOnFullBatchFailure: false,
  });
};

export const handler = middy(lambdaHandler).use(flushMetrics);
