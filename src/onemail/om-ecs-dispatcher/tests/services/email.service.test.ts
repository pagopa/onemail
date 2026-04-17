import env from '#config/env';
import { ApiError } from '#errors/api.error';
import { EmailPriority, EmailStatus } from 'om-common/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockAwsClient } from '../setup/awsMocks.js';
import {
  expectCommandInput,
  getNthCommand,
} from '../setup/commandAssertions.js';
import {
  makeHighPriorityEmailDto,
  makeLowPriorityEmailDto,
} from '../setup/dtoFactories.js';
import { createMockLogger } from '../setup/loggerMocks.js';

const setupEmailServiceDependencies = () => {
  const loggerMock = createMockLogger();
  const dynamoClientMock = createMockAwsClient();
  const sqsClientMock = createMockAwsClient();

  vi.doMock('#config/logger', () => ({
    getNamedLogger: vi.fn(() => loggerMock),
  }));
  vi.doMock('#errors/api.error', () => ({ ApiError }));
  vi.doMock('#connectors/dynamo.connector', () => ({
    dynamoClient: dynamoClientMock,
  }));
  vi.doMock('#connectors/sqs.connector', () => ({
    sqsClient: sqsClientMock,
  }));

  return {
    dynamoClientMock,
    loggerMock,
    sqsClientMock,
  };
};

describe('email.service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('sendEmailTransactional', () => {
    it('persists the email and publishes the high priority message', async () => {
      const { loggerMock, dynamoClientMock, sqsClientMock } =
        setupEmailServiceDependencies();
      dynamoClientMock.send.mockResolvedValueOnce({
        Items: [
          {
            tenantName: 'tenant-a',
            configSetName: 'config-set-a',
            clientId: 'client-id-a',
          },
        ],
      });
      const randomUUID = vi
        .fn()
        .mockReturnValueOnce('request-id-1')
        .mockReturnValueOnce('email-id-1');

      vi.doMock('node:crypto', () => ({ randomUUID }));

      const { sendEmailTransactional } =
        await import('#services/email.service');

      const result = await sendEmailTransactional(
        makeHighPriorityEmailDto(),
        false,
        'tenant-a',
      );

      expect(result).toEqual({ requestId: 'request-id-1' });
      const putCommand = expectCommandInput(
        dynamoClientMock.send,
        {
          TableName: env.aws.emailDbTable,
        },
        1,
      );
      const putItem = (
        putCommand.input as {
          Item: {
            requestId: string;
            emailId: string;
            content: { to: { email: string } };
          };
        }
      ).Item;
      expect(putItem.requestId).toBe('request-id-1');
      expect(putItem.emailId).toBe('email-id-1');
      expect(putItem.content.to.email).toBe('user@example.com');
      expect((putItem as { clientId?: string }).clientId).toBe('client-id-a');

      expectCommandInput(
        sqsClientMock.send,
        {
          QueueUrl: env.aws.sqs.highPriorityQueueUrl,
          MessageBody: JSON.stringify({ emailId: 'email-id-1' }),
        },
        0,
      );
      expect(loggerMock.info).toHaveBeenCalledWith('Start');
      expect(loggerMock.info).toHaveBeenCalledWith('End');
    });

    it('throws INVALID_TENANT when tenant configuration is missing', async () => {
      const { dynamoClientMock, sqsClientMock } =
        setupEmailServiceDependencies();
      dynamoClientMock.send.mockResolvedValueOnce({ Items: [] });

      const { sendEmailTransactional } =
        await import('#services/email.service');

      await expect(
        sendEmailTransactional(makeHighPriorityEmailDto(), false, 'tenant-a'),
      ).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'T001',
      });

      expect(sqsClientMock.send).not.toHaveBeenCalled();
    });
  });

  describe('sendEmailLowPriority', () => {
    it('splits low priority batches over the DynamoDB write limit', async () => {
      const { dynamoClientMock, sqsClientMock } =
        setupEmailServiceDependencies();
      dynamoClientMock.send.mockResolvedValueOnce({
        Items: [
          {
            tenantName: 'tenant-a',
            configSetName: 'config-set-a',
            clientId: 'client-id-a',
          },
        ],
      });
      const randomUUID = vi.fn();

      randomUUID.mockReturnValueOnce('request-id-2');
      for (let index = 1; index <= 26; index += 1) {
        randomUUID.mockReturnValueOnce(`email-id-${index}`);
      }

      vi.doMock('node:crypto', () => ({ randomUUID }));

      const { sendEmailLowPriority } = await import('#services/email.service');

      const sendingInfo = Array.from({ length: 26 }, (_, index) => ({
        to: {
          email: `user${index + 1}@example.com`,
        },
        templateAttributes: {
          item: index + 1,
        },
      }));

      const result = await sendEmailLowPriority(
        makeLowPriorityEmailDto({ sendingInfo }),
        false,
        'tenant-a',
      );

      expect(result).toEqual({ requestId: 'request-id-2' });
      expect(dynamoClientMock.send).toHaveBeenCalledTimes(3);

      const firstBatch = getNthCommand(dynamoClientMock.send, 1) as {
        input: { RequestItems: Record<string, unknown[]> };
      };
      const secondBatch = getNthCommand(dynamoClientMock.send, 2) as {
        input: { RequestItems: Record<string, unknown[]> };
      };

      expect(firstBatch.input.RequestItems[env.aws.emailDbTable]).toHaveLength(
        25,
      );
      expect(secondBatch.input.RequestItems[env.aws.emailDbTable]).toHaveLength(
        1,
      );

      const firstBatchFirstItem = firstBatch.input.RequestItems[
        env.aws.emailDbTable
      ][0] as {
        PutRequest: {
          Item: {
            clientId: string;
          };
        };
      };
      expect(firstBatchFirstItem.PutRequest.Item.clientId).toBe('client-id-a');

      expectCommandInput(
        sqsClientMock.send,
        {
          QueueUrl: env.aws.sqs.lowPriorityQueueUrl,
          MessageBody: JSON.stringify({ requestId: 'request-id-2' }),
        },
        0,
      );
    });

    it('throws INVALID_TENANT when tenant configuration is missing', async () => {
      const { dynamoClientMock, sqsClientMock } =
        setupEmailServiceDependencies();
      dynamoClientMock.send.mockResolvedValueOnce({ Items: [] });

      const { sendEmailLowPriority } = await import('#services/email.service');

      await expect(
        sendEmailLowPriority(makeLowPriorityEmailDto(), false, 'tenant-a'),
      ).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'T001',
      });

      expect(sqsClientMock.send).not.toHaveBeenCalled();
    });
  });
});

describe('email.service - getEmailStatus', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the history sorted in descending timestamp order', async () => {
    const { dynamoClientMock } = setupEmailServiceDependencies();

    dynamoClientMock.send
      .mockResolvedValueOnce({
        Items: [
          {
            tenantName: 'tenant-a',
            configSetName: 'config-set-a',
            clientId: 'client-id-a',
          },
        ],
      })
      .mockResolvedValueOnce({
        Items: [
          {
            emailId: 'email-id-3',
            requestId: 'request-id-3',
            priority: EmailPriority.HIGH,
            status: EmailStatus.Delivered,
            history: [
              {
                status: EmailStatus.Queued,
                changedAt: '2026-01-01T10:00:00.000Z',
              },
              {
                status: EmailStatus.Delivered,
                changedAt: '2026-01-01T11:00:00.000Z',
              },
            ],
            content: {
              from: { email: 'sender@example.com' },
              to: { email: 'user@example.com' },
            },
            clientId: 'client-id',
            dryRun: false,
          },
        ],
      });

    const { getEmailStatus } = await import('#services/email.service');

    const result = await getEmailStatus('request-id-3', 'tenant-a');

    expectCommandInput(
      dynamoClientMock.send,
      {
        TableName: env.aws.emailDbTable,
        IndexName: env.aws.emailDbRequestIdGSI,
      },
      1,
    );
    expect(result).toEqual([
      {
        emailId: 'email-id-3',
        priority: EmailPriority.HIGH,
        status: EmailStatus.Delivered,
        to: { email: 'user@example.com' },
        history: [
          {
            status: EmailStatus.Delivered,
            changedAt: '2026-01-01T11:00:00.000Z',
          },
          {
            status: EmailStatus.Queued,
            changedAt: '2026-01-01T10:00:00.000Z',
          },
        ],
        attempts: 0,
      },
    ]);
  });

  it('throws an ApiError when the requested email status does not exist', async () => {
    const { dynamoClientMock } = setupEmailServiceDependencies();

    dynamoClientMock.send
      .mockResolvedValueOnce({
        Items: [
          {
            tenantName: 'tenant-a',
            configSetName: 'config-set-a',
            clientId: 'client-id-a',
          },
        ],
      })
      .mockResolvedValueOnce({ Items: [] });

    const { getEmailStatus } = await import('#services/email.service');

    await expect(
      getEmailStatus('missing-request-id', 'tenant-a'),
    ).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 404,
      errorCode: 'R001',
    });
  });

  it('counts Dispatched events in history as attempts', async () => {
    const { dynamoClientMock } = setupEmailServiceDependencies();

    dynamoClientMock.send
      .mockResolvedValueOnce({
        Items: [
          {
            tenantName: 'tenant-a',
            configSetName: 'config-set-a',
            clientId: 'client-id-a',
          },
        ],
      })
      .mockResolvedValueOnce({
        Items: [
          {
            emailId: 'email-id-4',
            requestId: 'request-id-4',
            priority: EmailPriority.HIGH,
            status: EmailStatus.Delivered,
            history: [
              {
                status: EmailStatus.Queued,
                changedAt: '2026-01-01T10:00:00.000Z',
              },
              {
                status: EmailStatus.Dispatched,
                changedAt: '2026-01-01T10:01:00.000Z',
              },
              {
                status: EmailStatus.SoftBounce,
                changedAt: '2026-01-01T10:02:00.000Z',
              },
              {
                status: EmailStatus.Dispatched,
                changedAt: '2026-01-01T10:03:00.000Z',
              },
              {
                status: EmailStatus.Delivered,
                changedAt: '2026-01-01T10:04:00.000Z',
              },
            ],
            content: {
              from: { email: 'sender@example.com' },
              to: { email: 'user@example.com' },
            },
            clientId: 'client-id',
            dryRun: false,
          },
        ],
      });

    const { getEmailStatus } = await import('#services/email.service');

    const result = await getEmailStatus('request-id-4', 'tenant-a');

    expect(result[0].attempts).toBe(2);
  });
});

describe('email.service - getTenantConfiguration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('queries tenant configuration by tenantName GSI and returns the first item', async () => {
    const { dynamoClientMock } = setupEmailServiceDependencies();

    dynamoClientMock.send.mockResolvedValue({
      Items: [
        {
          tenantName: 'tenant-a',
          configSetName: 'config-set-a',
          clientId: 'client-id-a',
        },
      ],
    });

    const { getTenantConfiguration } = await import('#services/email.service');

    const result = await getTenantConfiguration('tenant-a');

    expectCommandInput(
      dynamoClientMock.send,
      {
        TableName: env.aws.tenantConfigurationTable,
        IndexName: env.aws.tenantDbConfigurationTenantNameGSI,
        KeyConditionExpression: '#tenantName = :tenantName',
        ExpressionAttributeNames: {
          '#tenantName': 'tenantName',
        },
        ExpressionAttributeValues: {
          ':tenantName': 'tenant-a',
        },
      },
      0,
    );

    expect(result).toEqual({
      tenantName: 'tenant-a',
      configSetName: 'config-set-a',
      clientId: 'client-id-a',
    });
  });

  it('returns undefined when tenant configuration does not exist', async () => {
    const { dynamoClientMock } = setupEmailServiceDependencies();

    dynamoClientMock.send.mockResolvedValue({ Items: [] });

    const { getTenantConfiguration } = await import('#services/email.service');

    const result = await getTenantConfiguration('missing-tenant');

    expect(result).toBeUndefined();
  });

  it('throws INVALID_TENANT when more than one tenant configuration exists for the same tenantName', async () => {
    const { dynamoClientMock } = setupEmailServiceDependencies();

    dynamoClientMock.send.mockResolvedValue({
      Items: [
        {
          tenantName: 'tenant-a',
          configSetName: 'config-set-a',
          clientId: 'client-id-a',
        },
        {
          tenantName: 'tenant-a',
          configSetName: 'config-set-b',
          clientId: 'client-id-b',
        },
      ],
    });

    const { getTenantConfiguration } = await import('#services/email.service');

    await expect(getTenantConfiguration('tenant-a')).rejects.toMatchObject({
      statusCode: 409,
      errorCode: 'T001',
    });
  });
});
