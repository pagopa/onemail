import type { Context, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';

import { addLambdaContextToLogger, getLogger } from '#config/logger';
import { dynamoStreamRecordHandler } from '#services/emailRetention.service';
import {
  BatchProcessor,
  EventType,
  processPartialResponse,
} from '@aws-lambda-powertools/batch';

const logger = getLogger();

class EmailRetentionBatchProcessor extends BatchProcessor {
  override failureHandler(record: DynamoDBRecord, error: Error) {
    logger.error('❌ Email retention failed, record will be retried', {
      sequenceNumber: record.dynamodb?.SequenceNumber,
      error,
    });
    return super.failureHandler(record, error);
  }
}

const processor = new EmailRetentionBatchProcessor(EventType.DynamoDBStreams);

export const handler = async (event: DynamoDBStreamEvent, context: Context) => {
  addLambdaContextToLogger(context);

  return processPartialResponse(event, dynamoStreamRecordHandler, processor, {
    context,
    throwOnFullBatchFailure: false,
  });
};
