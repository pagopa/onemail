import env from '#config/env';
import {
  getEmailStatus,
  sendEmailLowPriority,
  sendEmailTransactional,
} from '#services/email.service';
import { EmailPriority, EmailStatus } from 'om-common/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  expectCommandInput,
  getNthCommand,
} from '../../../testing/commandAssertions.js';
import {
  makeHighPriorityEmailDto,
  makeLowPriorityEmailDto,
} from '../__helpers__/dtoFactories.js';

const dynamoSend = vi.hoisted(() => vi.fn());
const sqsSend = vi.hoisted(() => vi.fn());
const randomUUID = vi.hoisted(() => vi.fn());

vi.mock('#connectors/dynamo.connector', () => ({
  dynamoClient: { send: dynamoSend },
}));
vi.mock('#connectors/sqs.connector', () => ({
  sqsClient: { send: sqsSend },
}));
vi.mock('node:crypto', () => ({ randomUUID }));

const setupEmailServiceDependencies = () => ({
  dynamoClientMock: { send: dynamoSend },
  sqsClientMock: { send: sqsSend },
});

describe('email.service', () => {
  describe('sendEmailTransactional', () => {
    it('persists the email and publishes the high priority message', async () => {
      randomUUID
        .mockReturnValueOnce('request-id-1')
        .mockReturnValueOnce('email-id-1');

      const result = await sendEmailTransactional(
        makeHighPriorityEmailDto(),
        false,
        'tenant-a',
      );

      expect(result).toEqual({ requestId: 'request-id-1' });
      const putCommand = expectCommandInput(
        dynamoSend,
        { TableName: env.aws.emailDbTable },
        0,
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
        sqsSend,
        {
          QueueUrl: env.aws.sqs.highPriorityQueueUrl,
          MessageBody: JSON.stringify({ emailId: 'email-id-1' }),
        },
        0,
      );
    });
    it('throws INVALID_TENANT when tenant configuration is missing', async () => {
      dynamoSend.mockResolvedValueOnce({ Items: [] });

      const { sendEmailTransactional } =
        await import('#services/email.service');

      await expect(
        sendEmailTransactional(makeHighPriorityEmailDto(), false, 'tenant-a'),
      ).rejects.toMatchObject({
        statusCode: 401,
        errorCode: 'T001',
      });

      expect(sqsSend).not.toHaveBeenCalled();
    });
  });

  describe('sendEmailLowPriority', () => {
    it('splits low priority batches over the DynamoDB write limit', async () => {
      randomUUID.mockReturnValueOnce('request-id-2');
      for (let index = 1; index <= 26; index += 1) {
        randomUUID.mockReturnValueOnce(`email-id-${index}`);
      }

      const sendingInfo = Array.from({ length: 26 }, (_, index) => ({
        to: { email: `user${index + 1}@example.com` },
        templateAttributes: { item: index + 1 },
      }));

      const result = await sendEmailLowPriority(
        makeLowPriorityEmailDto({ sendingInfo }),
        false,
        'tenant-a',
      );

      expect(result).toEqual({ requestId: 'request-id-2' });
      expect(dynamoSend).toHaveBeenCalledTimes(2);

      const firstBatch = getNthCommand(dynamoSend, 0) as {
        input: { RequestItems: Record<string, unknown[]> };
      };
      const secondBatch = getNthCommand(dynamoSend, 1) as {
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
        sqsSend,
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
        statusCode: 401,
        errorCode: 'T001',
      });

      expect(sqsClientMock.send).not.toHaveBeenCalled();
    });
  });
});

describe('email.service - getEmailStatus', () => {
  it('returns the history sorted in descending timestamp order', async () => {
    dynamoSend.mockResolvedValue({
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

    const result = await getEmailStatus('request-id-3', 'tenant-a');

    expectCommandInput(
      dynamoSend,
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
    dynamoSend.mockResolvedValue({ Items: [] });

    await expect(
      getEmailStatus('missing-request-id', 'tenant-a'),
    ).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 404,
      errorCode: 'R001',
    });
  });

  it('counts Dispatched events in history as attempts', async () => {
    dynamoSend.mockResolvedValue({
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

    const result = await getTenantConfiguration('tenant-a');
    expect(result).toBeUndefined();
  });
});
