import { handler } from '#app';
import { describe, expect, it, vi } from 'vitest';

import { makeStreamRecord } from './__helpers__/fixtures.js';

const dynamoStreamRecordHandler = vi.hoisted(() => vi.fn());

vi.mock('#services/emailRetention.service', () => ({
  dynamoStreamRecordHandler,
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
  });
});
