import {
  putBlacklistItems,
  scanAllBlacklistedAddresses,
} from '#repositories/blacklist.repository';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getNthCommand } from '../../../testing/commandAssertions.js';

const dynamoSend = vi.hoisted(() => vi.fn());

vi.mock('#connectors/dynamo.connector', () => ({
  dynamoClient: { send: dynamoSend },
}));
vi.mock('#config/env', () => ({
  default: {
    aws: { blacklistDbTable: 'blacklist-table' },
  },
}));

const makeItem = (emailAddress: string) => ({
  emailAddress,
  tenantName: 'suppressionList',
});
type WriteRequest = {
  PutRequest: { Item: ReturnType<typeof makeItem> };
};

const writeRequestsOfCall = (index: number): WriteRequest[] =>
  (
    getNthCommand(dynamoSend, index) as {
      input: { RequestItems: Record<string, WriteRequest[]> };
    }
  ).input.RequestItems['blacklist-table'];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('scanAllBlacklistedAddresses', () => {
  it('follows LastEvaluatedKey until the table is fully scanned', async () => {
    dynamoSend
      .mockResolvedValueOnce({
        Items: [{ emailAddress: 'first@example.it' }],
        LastEvaluatedKey: { emailAddress: 'first@example.it' },
      })
      .mockResolvedValueOnce({
        Items: [{ emailAddress: 'second@example.it' }],
      });

    const result = await scanAllBlacklistedAddresses();

    expect(dynamoSend).toHaveBeenCalledTimes(2);
    expect(result.map((item) => item.emailAddress)).toEqual([
      'first@example.it',
      'second@example.it',
    ]);
  });
});

describe('putBlacklistItems', () => {
  it('does not call DynamoDB when there is nothing to write', async () => {
    const written = await putBlacklistItems([]);

    expect(written).toBe(0);
    expect(dynamoSend).not.toHaveBeenCalled();
  });

  it('splits writes into batches of 25', async () => {
    dynamoSend.mockResolvedValue({});
    const items = Array.from({ length: 30 }, (_, index) =>
      makeItem(`user${index}@example.it`),
    );

    const written = await putBlacklistItems(items);

    expect(written).toBe(30);
    expect(dynamoSend).toHaveBeenCalledTimes(2);
    expect(writeRequestsOfCall(0)).toHaveLength(25);
    expect(writeRequestsOfCall(1)).toHaveLength(5);
  });

  it('limits the number of concurrent batch requests', async () => {
    const resolvers: ((response: object) => void)[] = [];
    let activeRequests = 0;
    let maximumActiveRequests = 0;

    dynamoSend.mockImplementation(
      () =>
        new Promise((resolve) => {
          activeRequests += 1;
          maximumActiveRequests = Math.max(
            maximumActiveRequests,
            activeRequests,
          );
          resolvers.push((response) => {
            activeRequests -= 1;
            resolve(response);
          });
        }),
    );

    const pending = putBlacklistItems(
      Array.from({ length: 150 }, (_, index) =>
        makeItem(`user${index}@example.it`),
      ),
    );

    expect(dynamoSend).toHaveBeenCalledTimes(4);

    let resolvedCount = 0;
    while (
      dynamoSend.mock.calls.length < 6 ||
      resolvedCount < resolvers.length
    ) {
      while (resolvedCount < resolvers.length) {
        resolvers[resolvedCount]({});
        resolvedCount += 1;
      }
      await Promise.resolve();
      await Promise.resolve();
    }

    await expect(pending).resolves.toBe(150);
    expect(maximumActiveRequests).toBe(4);
  });

  it('retries only unprocessed items', async () => {
    dynamoSend
      .mockResolvedValueOnce({
        UnprocessedItems: {
          'blacklist-table': [
            { PutRequest: { Item: makeItem('second@example.it') } },
          ],
        },
      })
      .mockResolvedValueOnce({});
    vi.useFakeTimers();

    const pending = putBlacklistItems([
      makeItem('first@example.it'),
      makeItem('second@example.it'),
    ]);
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toBe(2);
    expect(dynamoSend).toHaveBeenCalledTimes(2);
    expect(writeRequestsOfCall(1)).toEqual([
      { PutRequest: { Item: makeItem('second@example.it') } },
    ]);
  });

  it('waits using exponential full jitter before retrying', async () => {
    dynamoSend
      .mockResolvedValueOnce({
        UnprocessedItems: {
          'blacklist-table': [
            { PutRequest: { Item: makeItem('user@example.it') } },
          ],
        },
      })
      .mockResolvedValueOnce({});
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const pending = putBlacklistItems([makeItem('user@example.it')]);
    await vi.advanceTimersByTimeAsync(100);
    expect(dynamoSend).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe(1);
    expect(dynamoSend).toHaveBeenCalledTimes(2);
  });

  it('throws when unprocessed items remain after the retry limit', async () => {
    dynamoSend.mockImplementation(() => ({
      UnprocessedItems: {
        'blacklist-table': [
          { PutRequest: { Item: makeItem('user@example.it') } },
        ],
      },
    }));
    vi.useFakeTimers();

    const pending = putBlacklistItems([makeItem('user@example.it')]);
    const assertion = await expect(pending).rejects.toThrow(
      'Failed to insert 1 blacklist addresses after 5 retries',
    );
    await vi.runAllTimersAsync();

    await assertion;
    expect(dynamoSend).toHaveBeenCalledTimes(6);
  });
});
