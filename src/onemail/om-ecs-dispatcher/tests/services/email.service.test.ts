import env from '#config/env';
import {
  getEmailStatus,
  sendEmailLowPriority,
  sendEmailTransactional,
} from '#services/email.service';
import { EmailPriority, EmailStatus } from 'om-common/types';
import { describe, expect, it, vi } from 'vitest';

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

describe('email.service', () => {
  describe('sendEmailTransactional', () => {
    it('persists the email and publishes the high priority message', async () => {
      randomUUID
        .mockReturnValueOnce('request-id-1')
        .mockReturnValueOnce('email-id-1');

      const result = await sendEmailTransactional(
        makeHighPriorityEmailDto(),
        false,
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

      expectCommandInput(
        sqsSend,
        {
          QueueUrl: env.aws.sqs.highPriorityQueueUrl,
          MessageBody: JSON.stringify({ emailId: 'email-id-1' }),
        },
        0,
      );
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

      expectCommandInput(
        sqsSend,
        {
          QueueUrl: env.aws.sqs.lowPriorityQueueUrl,
          MessageBody: JSON.stringify({ requestId: 'request-id-2' }),
        },
        0,
      );
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

    const result = await getEmailStatus('request-id-3');

    expectCommandInput(
      dynamoSend,
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
        attempts: 0,
      },
    ]);
  });

  it('throws an ApiError when the requested email status does not exist', async () => {
    dynamoSend.mockResolvedValue({ Items: [] });

    await expect(getEmailStatus('missing-request-id')).rejects.toMatchObject({
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

    const result = await getEmailStatus('request-id-4');

    expect(result[0].attempts).toBe(2);
  });
});
