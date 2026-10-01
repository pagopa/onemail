import { addToBlacklist } from '#repositories/blacklist.repository';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
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
    dynamoSend.mockResolvedValue({});

    await addToBlacklist({
      emailAddress: '  User.Name@Example.IT ',
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
          tenantName: 'tenant-1',
        },
      },
      0,
    );
  });

  it('writes only the address from a display-name formatted recipient', async () => {
    dynamoSend.mockResolvedValue({});

    await addToBlacklist({
      emailAddress: 'User Name <User.Name@Example.IT>',
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
          tenantName: 'tenant-1',
        },
      },
      0,
    );
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
        tenantName: 'tenant-1',
      }),
    ).resolves.toBeUndefined();
  });

  it('rethrows any other DynamoDB error so the record is retried', async () => {
    dynamoSend.mockRejectedValue(new Error('Throttled'));

    await expect(
      addToBlacklist({
        emailAddress: 'user@example.it',
        tenantName: 'tenant-1',
      }),
    ).rejects.toThrow('Throttled');
  });
});
