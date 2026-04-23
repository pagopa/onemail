import {
  batchUpdateEmailStatuses,
  findEmailByProviderMessageId,
  updateEmailStatus,
} from '#repositories/email.repository';
import { EmailStatus } from 'om-common/types';
import { describe, expect, it, vi } from 'vitest';

import { expectCommandInput } from '../../../testing/commandAssertions.js';
import { makeEmailStatusHistoryItem } from '../__helpers__/fixtures.js';

const dynamoSend = vi.hoisted(() => vi.fn());
const publishMetrics = vi.hoisted(() => vi.fn());

vi.mock('#connectors/dynamo.connector', () => ({
  dynamoClient: { send: dynamoSend },
}));
vi.mock('#config/env', () => ({
  default: {
    aws: {
      emailDbTable: 'email-table',
      emailDbMessageIdGSI: 'message-id-gsi',
    },
  },
}));
vi.mock('om-common/repositories', () => ({
  ConfigSetProcessorMetricName: {
    EmailNotFound: 'EmailNotFound',
  },
  publishMetrics,
}));

describe('findEmailByProviderMessageId', () => {
  it('queries the GSI and returns the first matching item', async () => {
    const email = makeEmailStatusHistoryItem();
    dynamoSend.mockResolvedValue({ Items: [email] });

    const result = await findEmailByProviderMessageId('ses-msg-1');

    expect(result).toEqual(email);
    expectCommandInput(
      dynamoSend,
      {
        TableName: 'email-table',
        IndexName: 'message-id-gsi',
        KeyConditionExpression: '#providerMessageId = :providerMessageId',
        ExpressionAttributeValues: { ':providerMessageId': 'ses-msg-1' },
        Limit: 1,
      },
      0,
    );
    expect(publishMetrics).not.toHaveBeenCalled();
  });

  it('returns undefined and publishes EmailNotFound when no item exists', async () => {
    dynamoSend.mockResolvedValue({ Items: [] });

    const result = await findEmailByProviderMessageId('unknown-msg');

    expect(result).toBeUndefined();
    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'EmailNotFound' }]);
  });

  it('returns undefined and publishes EmailNotFound when Items is undefined', async () => {
    dynamoSend.mockResolvedValue({});

    const result = await findEmailByProviderMessageId('unknown-msg');

    expect(result).toBeUndefined();
    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'EmailNotFound' }]);
  });
});

describe('updateEmailStatus', () => {
  it('sends an UpdateCommand with the latest status and history entries', async () => {
    dynamoSend.mockResolvedValue({});

    await updateEmailStatus('email-1', EmailStatus.Dispatched, [
      {
        timestamp: '2025-06-01T12:00:00Z',
        status: EmailStatus.Delivered,
      },
    ]);

    expect(dynamoSend).toHaveBeenCalledTimes(1);
    expectCommandInput(
      dynamoSend,
      {
        TableName: 'email-table',
        Key: { emailId: 'email-1' },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': EmailStatus.Delivered,
          ':updatedAt': '2025-06-01T12:00:00Z',
        }),
      },
      0,
    );
  });

  it('selects the update with the latest timestamp as current status', async () => {
    dynamoSend.mockResolvedValue({});

    await updateEmailStatus('email-1', EmailStatus.Dispatched, [
      {
        timestamp: '2025-06-01T10:00:00Z',
        status: EmailStatus.SoftBounce,
        reason: 'MailboxFull',
      },
      {
        timestamp: '2025-06-01T12:00:00Z',
        status: EmailStatus.Queued,
        reason: 'retry',
      },
    ]);

    expect(dynamoSend).toHaveBeenCalledTimes(1);
    expectCommandInput(
      dynamoSend,
      {
        ExpressionAttributeValues: expect.objectContaining({
          ':status': EmailStatus.Queued,
          ':updatedAt': '2025-06-01T12:00:00Z',
        }),
      },
      0,
    );
  });

  it('returns early without sending when updates array is empty', async () => {
    await updateEmailStatus('email-1', EmailStatus.Dispatched, []);

    expect(dynamoSend).not.toHaveBeenCalled();
  });

  it('skips Delivered update when current status is not Dispatched', async () => {
    await updateEmailStatus('email-1', EmailStatus.Complaint, [
      {
        timestamp: '2025-06-01T12:00:00Z',
        status: EmailStatus.Delivered,
      },
    ]);

    expect(dynamoSend).not.toHaveBeenCalled();
  });

  it('allows Delivered update when current status is Dispatched', async () => {
    dynamoSend.mockResolvedValue({});

    await updateEmailStatus('email-1', EmailStatus.Dispatched, [
      {
        timestamp: '2025-06-01T12:00:00Z',
        status: EmailStatus.Delivered,
      },
    ]);

    expect(dynamoSend).toHaveBeenCalledTimes(1);
  });

  it('maps reason to undefined when null', async () => {
    dynamoSend.mockResolvedValue({});

    await updateEmailStatus('email-1', EmailStatus.Dispatched, [
      {
        timestamp: '2025-06-01T12:00:00Z',
        status: EmailStatus.Rejected,
        reason: null,
      },
    ]);

    expectCommandInput(
      dynamoSend,
      {
        ExpressionAttributeValues: expect.objectContaining({
          ':newHistoryItems': [
            {
              status: EmailStatus.Rejected,
              changedAt: '2025-06-01T12:00:00Z',
              reason: undefined,
            },
          ],
        }),
      },
      0,
    );
  });
});

describe('batchUpdateEmailStatuses', () => {
  it('returns early without sending when updates array is empty', async () => {
    await batchUpdateEmailStatuses([]);

    expect(dynamoSend).not.toHaveBeenCalled();
  });

  it('sends a single BatchWriteCommand for updates within the 25-item limit', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    dynamoSend.mockResolvedValue({ UnprocessedItems: {} });

    await batchUpdateEmailStatuses([
      {
        item: email,
        status: EmailStatus.Delivered,
        providerMessageId: 'msg-1',
      },
    ]);

    expect(dynamoSend).toHaveBeenCalledTimes(1);
    expectCommandInput(
      dynamoSend,
      {
        RequestItems: {
          'email-table': [
            expect.objectContaining({
              PutRequest: expect.objectContaining({
                Item: expect.objectContaining({
                  emailId: 'email-1',
                  status: EmailStatus.Delivered,
                  providerMessageId: 'msg-1',
                }),
              }),
            }),
          ],
        },
      },
      0,
    );
  });

  it('appends new status to existing history', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
      history: [
        { status: EmailStatus.Queued, changedAt: '2025-01-01T00:00:00Z' },
      ],
    });
    dynamoSend.mockResolvedValue({ UnprocessedItems: {} });

    await batchUpdateEmailStatuses([
      { item: email, status: EmailStatus.Delivered },
    ]);

    const command = dynamoSend.mock.calls[0][0];
    const putItem =
      command.input.RequestItems['email-table'][0].PutRequest.Item;
    expect(putItem.history).toHaveLength(2);
    expect(putItem.history[0].status).toBe(EmailStatus.Queued);
    expect(putItem.history[1].status).toBe(EmailStatus.Delivered);
  });

  it('splits updates into batches of 25', async () => {
    const emails = Array.from({ length: 30 }, (_, i) =>
      makeEmailStatusHistoryItem({
        emailId: `email-${i}`,
        status: EmailStatus.Dispatched,
      }),
    );
    dynamoSend.mockResolvedValue({ UnprocessedItems: {} });

    await batchUpdateEmailStatuses(
      emails.map((item) => ({ item, status: EmailStatus.Delivered })),
    );

    // 2 batches: 25 + 5
    expect(dynamoSend).toHaveBeenCalledTimes(2);
  });

  it('retries unprocessed items from BatchWriteCommand', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });

    // First call returns unprocessed with proper structure, second call succeeds
    dynamoSend
      .mockResolvedValueOnce({
        UnprocessedItems: {
          'email-table': [
            {
              PutRequest: {
                Item: { emailId: 'email-1' },
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({ UnprocessedItems: {} });

    await batchUpdateEmailStatuses([
      { item: email, status: EmailStatus.Delivered },
    ]);

    expect(dynamoSend).toHaveBeenCalledTimes(2);
  });

  it('throws AggregateError when a batch fails after max retries', async () => {
    const email = makeEmailStatusHistoryItem({
      emailId: 'email-fail',
      status: EmailStatus.Dispatched,
    });

    // Always return unprocessed items to exhaust retries (MAX_RETRIES = 3, so 4 calls)
    dynamoSend.mockResolvedValue({
      UnprocessedItems: {
        'email-table': [
          {
            PutRequest: {
              Item: { emailId: 'email-fail' },
            },
          },
        ],
      },
    });

    await expect(
      batchUpdateEmailStatuses([
        { item: email, status: EmailStatus.Delivered },
      ]),
    ).rejects.toThrow('Failed to update');
  });

  it('preserves existing providerMessageId when not provided in update', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
      providerMessageId: 'existing-msg-id',
    } as never);
    dynamoSend.mockResolvedValue({ UnprocessedItems: {} });

    await batchUpdateEmailStatuses([
      { item: email, status: EmailStatus.Delivered },
    ]);

    const command = dynamoSend.mock.calls[0][0];
    const putItem =
      command.input.RequestItems['email-table'][0].PutRequest.Item;
    expect(putItem.providerMessageId).toBe('existing-msg-id');
  });
});
