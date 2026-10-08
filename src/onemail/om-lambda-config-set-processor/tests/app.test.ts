import { handler } from '#app';
import { RetryableEventError } from 'om-common/errors';
import { describe, expect, it, vi } from 'vitest';

const sqsEventHandler = vi.hoisted(() => vi.fn());

vi.mock('#services/emailStatus.service', () => ({ sqsEventHandler }));
vi.mock('@middy/core', () => ({
  default: (lambdaHandler: unknown) => ({ use: () => lambdaHandler }),
}));
vi.mock('om-common/repositories', () => ({
  ConfigSetProcessorMetricName: {
    UnexpectedRetryableError: 'UnexpectedRetryableError',
  },
  flushMetrics: {},
  publishMetrics: vi.fn(),
}));

describe('config-set-processor handler', () => {
  it('returns failed record identifiers without rejecting when the entire batch fails', async () => {
    sqsEventHandler.mockRejectedValue(
      new RetryableEventError('Email record not found', {
        providerMessageId: 'provider-message-1',
        attempt: 1,
      }),
    );

    const event = {
      Records: [
        {
          messageId: 'sqs-message-1',
          receiptHandle: 'receipt-1',
          body: '{}',
          attributes: {},
          messageAttributes: {},
          md5OfBody: 'md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:eu-south-1:123456789012:queue',
          awsRegion: 'eu-south-1',
        },
      ],
    };

    const result = await handler(event as never, {} as never);

    expect(result).toEqual({
      batchItemFailures: [{ itemIdentifier: 'sqs-message-1' }],
    });
  });
});
