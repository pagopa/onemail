import { findBlacklistedAddresses } from '#repositories/blacklist.repository';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getNthCommand } from '../../../testing/commandAssertions.js';

const dynamoSend = vi.hoisted(() => vi.fn());
const loggerWarn = vi.hoisted(() => vi.fn());

vi.mock('#connectors/dynamo.connector', () => ({
  dynamoClient: { send: dynamoSend },
}));
vi.mock('#config/logger', () => ({
  getLogger: () => ({ warn: loggerWarn }),
  getNamedLogger: () => ({ warn: loggerWarn }),
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
  it('returns an empty set without querying DynamoDB when there are no addresses', async () => {
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

  it('returns only the blacklisted addresses as normalized strings', async () => {
    dynamoSend.mockResolvedValue({
      Responses: {
        'blacklist-table': [
          { emailAddress: 'User@Example.IT', tenantName: 'tenant-1' },
        ],
      },
    });

    const result = await findBlacklistedAddresses([
      'user@example.it',
      'other@example.it',
    ]);

    expect([...result]).toEqual(['user@example.it']);
  });

  it('returns processed addresses and logs unprocessed keys without retrying', async () => {
    dynamoSend.mockResolvedValueOnce({
      Responses: {
        'blacklist-table': [{ emailAddress: 'first@example.it' }],
      },
      UnprocessedKeys: {
        'blacklist-table': { Keys: [{ emailAddress: 'second@example.it' }] },
      },
    });

    const result = await findBlacklistedAddresses([
      'first@example.it',
      'second@example.it',
    ]);

    expect(dynamoSend).toHaveBeenCalledTimes(1);
    expect(keysOfCall(0)).toEqual(['first@example.it', 'second@example.it']);
    expect([...result]).toEqual(['first@example.it']);
    expect(loggerWarn).toHaveBeenCalledWith(
      'Some blacklist entries were not processed',
      { unprocessedCount: 1 },
    );
  });
});
