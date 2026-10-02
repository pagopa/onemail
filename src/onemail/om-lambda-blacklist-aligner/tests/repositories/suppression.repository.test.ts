import { listAllSuppressedDestinations } from '#repositories/suppression.repository';
import { TooManyRequestsException } from '@aws-sdk/client-sesv2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getNthCommand } from '../../../testing/commandAssertions.js';

const sesSend = vi.hoisted(() => vi.fn());

vi.mock('#connectors/ses.connector', () => ({
  sesClient: { send: sesSend },
}));

const throttled = () =>
  new TooManyRequestsException({ $metadata: {}, message: 'Too many requests' });

const nextTokenOfCall = (index: number): string | undefined =>
  (getNthCommand(sesSend, index) as { input: { NextToken?: string } }).input
    .NextToken;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

describe('listAllSuppressedDestinations', () => {
  it('follows NextToken until the whole list is retrieved', async () => {
    sesSend
      .mockResolvedValueOnce({
        SuppressedDestinationSummaries: [
          { EmailAddress: 'First@Example.IT', Reason: 'BOUNCE' },
        ],
        NextToken: 'page-2',
      })
      .mockResolvedValueOnce({
        SuppressedDestinationSummaries: [
          { EmailAddress: 'second@example.it', Reason: 'COMPLAINT' },
        ],
      });

    const result = await listAllSuppressedDestinations();

    expect(sesSend).toHaveBeenCalledTimes(2);
    expect(nextTokenOfCall(0)).toBeUndefined();
    expect(nextTokenOfCall(1)).toBe('page-2');
    expect([...result.keys()]).toEqual([
      'first@example.it',
      'second@example.it',
    ]);
    expect(result.get('second@example.it')).toEqual({
      emailAddress: 'second@example.it',
    });
  });

  it('skips summaries without an email address', async () => {
    sesSend.mockResolvedValueOnce({
      SuppressedDestinationSummaries: [{ Reason: 'BOUNCE' }],
    });

    const result = await listAllSuppressedDestinations();

    expect(result.size).toBe(0);
  });

  it('retries with backoff when SES throttles the request', async () => {
    sesSend
      .mockRejectedValueOnce(throttled())
      .mockResolvedValueOnce({ SuppressedDestinationSummaries: [] });

    const pending = listAllSuppressedDestinations();
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(sesSend).toHaveBeenCalledTimes(2);
    expect(result.size).toBe(0);
  });

  it('propagates the error when the retry budget is exhausted', async () => {
    sesSend.mockRejectedValue(throttled());

    const pending = listAllSuppressedDestinations();
    const assertion =
      await expect(pending).rejects.toThrow('Too many requests');
    await vi.runAllTimersAsync();
    await assertion;

    expect(sesSend).toHaveBeenCalledTimes(6);
  });

  it('propagates any non throttling error without retrying', async () => {
    sesSend.mockRejectedValue(new Error('AccessDenied'));

    await expect(listAllSuppressedDestinations()).rejects.toThrow(
      'AccessDenied',
    );
    expect(sesSend).toHaveBeenCalledTimes(1);
  });
});
