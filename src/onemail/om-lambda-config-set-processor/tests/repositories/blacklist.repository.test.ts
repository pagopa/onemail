import { addToBlacklist } from '#repositories/blacklist.repository';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { BlacklistSource } from 'om-common/types';
import { describe, expect, it, vi } from 'vitest';

import { expectCommandInput } from '../../../testing/commandAssertions.js';

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

describe('addToBlacklist', () => {
  it('writes the normalized address with an idempotent condition', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    dynamoSend.mockResolvedValue({});

    await addToBlacklist({
      emailAddress: '  User.Name@Example.IT ',
      source: BlacklistSource.Event,
      reason: 'BOUNCE',
      bounceSubType: 'General',
      tenantName: 'tenant-1',
    });

    expect(dynamoSend).toHaveBeenCalledTimes(1);
    expectCommandInput(
      dynamoSend,
      {
        TableName: 'blacklist-table',
        ConditionExpression: 'attribute_not_exists(emailAddress)',
        Item: {
          emailAddress: 'user.name@example.it',
          source: BlacklistSource.Event,
          reason: 'BOUNCE',
          bounceSubType: 'General',
          tenantName: 'tenant-1',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      },
      0,
    );

    vi.useRealTimers();
  });

  it('swallows ConditionalCheckFailedException when the address already exists', async () => {
    dynamoSend.mockRejectedValue(
      new ConditionalCheckFailedException({
        $metadata: {},
        message: 'The conditional request failed',
      }),
    );

    await expect(
      addToBlacklist({
        emailAddress: 'user@example.it',
        source: BlacklistSource.Event,
      }),
    ).resolves.toBeUndefined();
  });

  it('rethrows any other DynamoDB error so the record is retried', async () => {
    dynamoSend.mockRejectedValue(new Error('Throttled'));

    await expect(
      addToBlacklist({
        emailAddress: 'user@example.it',
        source: BlacklistSource.Sync,
      }),
    ).rejects.toThrow('Throttled');
  });
});
