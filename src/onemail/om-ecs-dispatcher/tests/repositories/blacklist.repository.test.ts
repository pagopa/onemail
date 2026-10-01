import { findBlacklistedAddresses } from '#repositories/blacklist.repository';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getNthCommand } from '../../../testing/commandAssertions.js';

const dynamoSend = vi.hoisted(() => vi.fn());

vi.mock('#connectors/dynamo.connector', () => ({
  dynamoClient: { send: dynamoSend },
}));
vi.mock('#config/env', () => ({
  default: {
    aws: {
      blacklistDbTable: 'blacklist-table',
    },
  },
}));

type BatchGetInput = {
  RequestItems: Record<string, { Keys: { emailAddress: string }[] }>;
};

const keysOfCall = (index: number): string[] =>
  (
    getNthCommand(dynamoSend, index) as { input: BatchGetInput }
  ).input.RequestItems['blacklist-table'].Keys.map((key) => key.emailAddress);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findBlacklistedAddresses', () => {
  it('returns an empty map without querying DynamoDB when there are no addresses', async () => {
    const result = await findBlacklistedAddresses([]);

    expect(result.size).toBe(0);
    expect(dynamoSend).not.toHaveBeenCalled();
  });

  it('normalizes and deduplicates addresses before the lookup', async () => {
    dynamoSend.mockResolvedValue({ Responses: { 'blacklist-table': [] } });

    await findBlacklistedAddresses([
      '  User@Example.IT ',
      'user@example.it',
      'other@example.it',
    ]);

    expect(dynamoSend).toHaveBeenCalledTimes(1);
    expect(keysOfCall(0)).toEqual(['user@example.it', 'other@example.it']);
  });

  it('returns only the blacklisted addresses keyed by normalized address', async () => {
    dynamoSend.mockResolvedValue({
      Responses: {
        'blacklist-table': [
          { emailAddress: 'User@Example.IT', reason: 'BOUNCE' },
        ],
      },
    });

    const result = await findBlacklistedAddresses([
      'user@example.it',
      'other@example.it',
    ]);

    expect([...result.keys()]).toEqual(['user@example.it']);
    expect(result.get('user@example.it')).toMatchObject({ reason: 'BOUNCE' });
  });

  it('splits the lookup into chunks of 100 keys', async () => {
    dynamoSend.mockResolvedValue({ Responses: { 'blacklist-table': [] } });
    const addresses = Array.from(
      { length: 150 },
      (_, index) => `user${index}@example.it`,
    );

    await findBlacklistedAddresses(addresses);

    expect(dynamoSend).toHaveBeenCalledTimes(2);
    expect(keysOfCall(0)).toHaveLength(100);
    expect(keysOfCall(1)).toHaveLength(50);
  });

  it('retries unprocessed keys and merges the results', async () => {
    dynamoSend
      .mockResolvedValueOnce({
        Responses: {
          'blacklist-table': [{ emailAddress: 'first@example.it' }],
        },
        UnprocessedKeys: {
          'blacklist-table': { Keys: [{ emailAddress: 'second@example.it' }] },
        },
      })
      .mockResolvedValueOnce({
        Responses: {
          'blacklist-table': [{ emailAddress: 'second@example.it' }],
        },
      });

    const result = await findBlacklistedAddresses([
      'first@example.it',
      'second@example.it',
    ]);

    expect(dynamoSend).toHaveBeenCalledTimes(2);
    expect(keysOfCall(1)).toEqual(['second@example.it']);
    expect([...result.keys()]).toEqual([
      'first@example.it',
      'second@example.it',
    ]);
  });

  it('gives up after the retry budget and returns what was found', async () => {
    dynamoSend.mockResolvedValue({
      Responses: { 'blacklist-table': [] },
      UnprocessedKeys: {
        'blacklist-table': { Keys: [{ emailAddress: 'user@example.it' }] },
      },
    });

    const result = await findBlacklistedAddresses(['user@example.it']);

    expect(result.size).toBe(0);
    expect(dynamoSend).toHaveBeenCalledTimes(4);
  });
});
