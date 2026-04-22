import { handleSoftBounceRetry } from '#services/bounceRetry.service';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { EmailPriority, EmailStatus } from 'om-common/types';
import { describe, expect, it, vi } from 'vitest';

import { getNthCommand } from '../../../testing/commandAssertions.js';
import { makeEmailStatusHistoryItem } from '../__helpers__/fixtures.js';

const updateEmailStatus = vi.hoisted(() => vi.fn());
const sqsSend = vi.hoisted(() => vi.fn());
const publishMetrics = vi.hoisted(() => vi.fn());

vi.mock('#repositories/email.repository', () => ({
  updateEmailStatus,
}));
vi.mock('#connectors/sqs.connector', () => ({
  sqsClient: { send: sqsSend },
}));
vi.mock('#config/env', () => ({
  default: {
    aws: {
      sqs: {
        highPriorityQueueUrl: 'https://sqs.eu-south-1.amazonaws.com/123/high',
        lowPriorityQueueUrl: 'https://sqs.eu-south-1.amazonaws.com/123/low',
      },
    },
  },
}));
vi.mock('om-common/repositories', () => ({
  ConfigSetProcessorMetricName: {
    EmailHighPriorityRetry: 'HighPriorityRetry',
    EmailLowPriorityRetry: 'LowPriorityRetry',
    HighPriorityEmailMaxRetriesReached: 'HighPriorityMaxRetriesReached',
    LowPriorityEmailMaxRetriesReached: 'LowPriorityMaxRetriesReached',
    ScheduleRetryFailed: 'ScheduleRetryFailed',
  },
  publishMetrics,
}));

describe('bounceRetry.service high priority retry', () => {
  it('enqueues a retry via SQS and updates status to Queued when under max attempts', async () => {
    const email = makeEmailStatusHistoryItem({
      priority: EmailPriority.HIGH,
      history: [],
    });
    sqsSend.mockResolvedValue({});

    await handleSoftBounceRetry(email, '2025-06-01T12:00:00Z', 'MailboxFull');

    expect(sqsSend).toHaveBeenCalledTimes(1);
    const command = getNthCommand(sqsSend, 0);
    expect(command).toBeInstanceOf(SendMessageCommand);
    expect((command as SendMessageCommand).input).toEqual({
      QueueUrl: 'https://sqs.eu-south-1.amazonaws.com/123/high',
      MessageBody: JSON.stringify({ emailId: 'email-1' }),
      DelaySeconds: 900,
    });

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.SoftBounce,
          reason: 'MailboxFull',
        },
        expect.objectContaining({
          status: EmailStatus.Queued,
          reason: 'Queued for high-priority soft bounce retry attempt 1',
        }),
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityRetry',
        dimensions: { attempt: '1' },
      },
    ]);
  });

  it('escalates to MaxRetriesReached when soft bounce count exceeds max attempts', async () => {
    const history = Array.from({ length: 5 }, () => ({
      status: EmailStatus.SoftBounce,
      changedAt: '2025-01-01T00:00:00Z',
    }));
    const email = makeEmailStatusHistoryItem({
      priority: EmailPriority.HIGH,
      history,
    });

    await handleSoftBounceRetry(email, '2025-06-01T12:00:00Z', 'General');

    expect(sqsSend).not.toHaveBeenCalled();
    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.SoftBounce,
          reason: 'General',
        },
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.MaxRetriesReached,
          reason: 'SoftBounce escalated to MaxRetriesReached after 6 attempts',
        },
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'HighPriorityMaxRetriesReached' },
    ]);
  });

  it('counts only SoftBounce events in history for attempt calculation', async () => {
    const history = [
      { status: EmailStatus.Dispatched, changedAt: '2025-01-01T00:00:00Z' },
      { status: EmailStatus.SoftBounce, changedAt: '2025-01-02T00:00:00Z' },
      { status: EmailStatus.Queued, changedAt: '2025-01-02T00:01:00Z' },
      { status: EmailStatus.Dispatched, changedAt: '2025-01-02T00:16:00Z' },
    ];
    const email = makeEmailStatusHistoryItem({
      priority: EmailPriority.HIGH,
      history,
    });
    sqsSend.mockResolvedValue({});

    await handleSoftBounceRetry(email, '2025-06-01T12:00:00Z');

    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityRetry',
        dimensions: { attempt: '2' },
      },
    ]);
  });

  it('passes undefined bounceSubType as reason when not provided', async () => {
    const email = makeEmailStatusHistoryItem({
      priority: EmailPriority.HIGH,
    });
    sqsSend.mockResolvedValue({});

    await handleSoftBounceRetry(email, '2025-06-01T12:00:00Z');

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      expect.arrayContaining([
        expect.objectContaining({
          status: EmailStatus.SoftBounce,
          reason: undefined,
        }),
      ]),
    );
  });
});

describe('bounceRetry.service low priority retry', () => {
  it('enqueues a retry via SQS using the low priority queue and requestId', async () => {
    const email = makeEmailStatusHistoryItem({
      priority: EmailPriority.LOW,
      requestId: 'request-42',
      history: [],
    });
    sqsSend.mockResolvedValue({});

    await handleSoftBounceRetry(email, '2025-06-01T12:00:00Z', 'General');

    expect(sqsSend).toHaveBeenCalledTimes(1);
    const command = getNthCommand(sqsSend, 0);
    expect(command).toBeInstanceOf(SendMessageCommand);
    expect((command as SendMessageCommand).input).toEqual({
      QueueUrl: 'https://sqs.eu-south-1.amazonaws.com/123/low',
      MessageBody: JSON.stringify({ requestId: 'request-42' }),
      DelaySeconds: 900,
    });

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.SoftBounce,
          reason: 'General',
        },
        expect.objectContaining({
          status: EmailStatus.Queued,
          reason: 'Queued for low-priority soft bounce retry attempt 1',
        }),
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'LowPriorityRetry',
        dimensions: { attempt: '1' },
      },
    ]);
  });

  it('escalates to MaxRetriesReached for low priority when exceeding max attempts', async () => {
    const history = Array.from({ length: 5 }, () => ({
      status: EmailStatus.SoftBounce,
      changedAt: '2025-01-01T00:00:00Z',
    }));
    const email = makeEmailStatusHistoryItem({
      priority: EmailPriority.LOW,
      history,
    });

    await handleSoftBounceRetry(email, '2025-06-01T12:00:00Z', 'General');

    expect(sqsSend).not.toHaveBeenCalled();
    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.SoftBounce,
          reason: 'General',
        },
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.MaxRetriesReached,
          reason: 'SoftBounce escalated to MaxRetriesReached after 6 attempts',
        },
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'LowPriorityMaxRetriesReached' },
    ]);
  });
});

describe('bounceRetry.service SQS failure', () => {
  it('publishes ScheduleRetryFailed and rethrows when SQS send fails', async () => {
    const email = makeEmailStatusHistoryItem({
      priority: EmailPriority.HIGH,
      history: [],
    });
    sqsSend.mockRejectedValue(new Error('SQS unavailable'));

    await expect(
      handleSoftBounceRetry(email, '2025-06-01T12:00:00Z', 'General'),
    ).rejects.toThrow('SQS unavailable');

    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'ScheduleRetryFailed',
        dimensions: { reason: 'SqsSendMessageFailed' },
      },
    ]);
    expect(updateEmailStatus).not.toHaveBeenCalled();
  });
});
