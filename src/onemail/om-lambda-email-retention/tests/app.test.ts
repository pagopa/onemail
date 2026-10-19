import { handler } from '#app';
import { RetryableEventError } from 'om-common/errors';
import {
  EmailRetentionMetricName,
  publishMetrics,
} from 'om-common/repositories';
import { describe, expect, it, vi } from 'vitest';

import { makeStreamRecord } from './__helpers__/fixtures.js';

const dynamoStreamRecordHandler = vi.hoisted(() => vi.fn());
const metricsMocks = vi.hoisted(() => ({
  publishMetrics: vi.fn(),
  flushMetrics: { after: vi.fn() },
}));

vi.mock('#services/emailRetention.service', () => ({
  dynamoStreamRecordHandler,
}));
vi.mock('om-common/repositories', () => ({
  EmailRetentionMetricName: {
    UnexpectedRetryableError: 'EmailRetentionUnexpectedRetryableError',
  },
  flushMetrics: metricsMocks.flushMetrics,
  publishMetrics: metricsMocks.publishMetrics,
}));

describe('email retention handler', () => {
  it('returns no failures when every record is processed', async () => {
    dynamoStreamRecordHandler.mockResolvedValue(undefined);

    const result = await handler(
      { Records: [makeStreamRecord('100'), makeStreamRecord('200')] },
      {} as never,
    );

    expect(result).toEqual({ batchItemFailures: [] });
  });

  it('reports the sequence number of failed records without rejecting', async () => {
    dynamoStreamRecordHandler.mockRejectedValueOnce(
      new Error('S3 unavailable'),
    );

    const result = await handler(
      { Records: [makeStreamRecord('100')] },
      {} as never,
    );

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: '100' }] });
    expect(publishMetrics).toHaveBeenCalledWith([
      { name: EmailRetentionMetricName.UnexpectedRetryableError },
    ]);
  });

  it('does not publish the unexpected error metric for RetryableEventError', async () => {
    dynamoStreamRecordHandler.mockRejectedValueOnce(
      new RetryableEventError('Temporary failure', { emailId: 'email-1' }),
    );

    await handler({ Records: [makeStreamRecord('100')] }, {} as never);

    expect(publishMetrics).not.toHaveBeenCalled();
  });
});
