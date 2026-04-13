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
      );

      expect(result).toEqual({ requestId: 'request-id-1' });
      const putCommand = expectCommandInput(
        dynamoClientMock.send,
        {
          TableName: env.aws.emailDbTable,
        },
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
  });

  describe('sendEmailLowPriority', () => {
    it('splits low priority batches over the DynamoDB write limit', async () => {
      const { dynamoClientMock, sqsClientMock } =
        setupEmailServiceDependencies();
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
      );

      expect(result).toEqual({ requestId: 'request-id-2' });
      expect(dynamoClientMock.send).toHaveBeenCalledTimes(2);

      const firstBatch = getNthCommand(dynamoClientMock.send, 0) as {
        input: { RequestItems: Record<string, unknown[]> };
      };
      const secondBatch = getNthCommand(dynamoClientMock.send, 1) as {
        input: { RequestItems: Record<string, unknown[]> };
      };

      expect(firstBatch.input.RequestItems[env.aws.emailDbTable]).toHaveLength(
        25,
      );
      expect(secondBatch.input.RequestItems[env.aws.emailDbTable]).toHaveLength(
        1,
      );

      expectCommandInput(
        sqsClientMock.send,
        {
          QueueUrl: env.aws.sqs.lowPriorityQueueUrl,
          MessageBody: JSON.stringify({ requestId: 'request-id-2' }),
        },
        0,
      );
    });
  });

  describe('getEmailStatus', () => {
    it('returns the history sorted in descending timestamp order', async () => {
      const { dynamoClientMock } = setupEmailServiceDependencies();

      dynamoClientMock.send.mockResolvedValue({
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

      const result = await getEmailStatus('request-id-3');

      expectCommandInput(
        dynamoClientMock.send,
        {
          TableName: env.aws.emailDbTable,
          IndexName: env.aws.emailDbRequestIdGSI,
        },
        0,
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
        },
      ]);
    });

    it('throws an ApiError when the requested email status does not exist', async () => {
      const { dynamoClientMock } = setupEmailServiceDependencies();

      dynamoClientMock.send.mockResolvedValue({ Items: [] });

      const { getEmailStatus } = await import('#services/email.service');

      await expect(getEmailStatus('missing-request-id')).rejects.toMatchObject({
        name: 'ApiError',
        statusCode: 404,
        errorCode: 'R001',
      });
    });
  });
});
